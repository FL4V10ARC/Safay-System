const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {FieldValue} = require('firebase-admin/firestore');
const {db} = require('../config/firebase');
const logger = require('firebase-functions/logger');

exports.createOrder = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const {
    items,
    deliveryType = 'RETIRADA',
    deliveryFee = 0,
    deliveryAddress = {},
    notes = '',
  } = request.data;

  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError('invalid-argument', 'O pedido deve possuir pelo menos um item.');
  }

  if (typeof deliveryFee !== 'number' || deliveryFee < 0) {
    throw new HttpsError('invalid-argument', 'Taxa de entrega inválida.');
  }

  if (!['RETIRADA', 'ENTREGA'].includes(deliveryType)) {
    throw new HttpsError('invalid-argument', 'Tipo de entrega inválido.');
  }

  const userId = request.auth.uid;
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError('failed-precondition', 'Perfil do cliente não encontrado.');
  }

  const user = userSnap.data();

  if (user.active !== true) {
    throw new HttpsError('permission-denied', 'Usuário inativo.');
  }

  // Valida estrutura básica dos itens antes de abrir a transaction
  for (const item of items) {
    if (!item.productId || !item.variantId || !item.quantity) {
      throw new HttpsError('invalid-argument', 'Produto, variação e quantidade são obrigatórios.');
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      throw new HttpsError('invalid-argument', 'Quantidade deve ser um número inteiro positivo.');
    }
  }

  const orderRef = db.collection('orders').doc();

  try {
    await db.runTransaction(async (transaction) => {
      const orderItems = [];
      let total = 0;

      for (const item of items) {
        const productRef = db.collection('products').doc(item.productId);
        const variantRef = productRef.collection('variants').doc(item.variantId);

        // Leituras DENTRO da transaction
        const [productDoc, variantDoc] = await Promise.all([
          transaction.get(productRef),
          transaction.get(variantRef),
        ]);

        if (!productDoc.exists) {
          throw new HttpsError('not-found', `Produto ${item.productId} não encontrado.`);
        }
        if (productDoc.data().active !== true) {
          throw new HttpsError('failed-precondition', `Produto "${productDoc.data().name}" indisponível.`);
        }
        if (!variantDoc.exists) {
          throw new HttpsError('not-found', `Variante ${item.variantId} não encontrada.`);
        }
        if (variantDoc.data().active !== true) {
          throw new HttpsError('failed-precondition', 'Variação indisponível.');
        }

        const currentStock = variantDoc.data().stock ?? 0;

        if (currentStock < item.quantity) {
          throw new HttpsError(
              'failed-precondition',
              `Estoque insuficiente para "${productDoc.data().name}". Disponível: ${currentStock}.`,
          );
        }

        const unitPrice = variantDoc.data().price;
        const subtotal = unitPrice * item.quantity;
        const newStock = currentStock - item.quantity;

        transaction.update(variantRef, {
          stock: newStock,
          updatedAt: FieldValue.serverTimestamp(),
        });

        const movementRef = db.collection('stock_movements').doc();
        transaction.set(movementRef, {
          productId: item.productId,
          variantId: item.variantId,
          type: 'OUT',
          reason: 'ORDER_CREATED',
          quantity: item.quantity,
          previousStock: currentStock,
          newStock,
          orderId: orderRef.id,
          createdAt: FieldValue.serverTimestamp(),
        });

        total += subtotal;

        orderItems.push({
          productId: item.productId,
          variantId: item.variantId,
          productName: productDoc.data().name,
          color: variantDoc.data().color,
          size: variantDoc.data().size,
          quantity: item.quantity,
          unitPrice,
          subtotal,
        });
      }

      total += deliveryFee;

      transaction.set(orderRef, {
        customerId: userId,
        customerSnapshot: {
          name: user.name,
          email: user.email,
          phone: user.phone || '',
        },
        deliveryAddress,
        items: orderItems,
        total,
        status: 'PENDENTE',
        paymentStatus: 'PENDENTE',
        deliveryType,
        deliveryFee,
        notes: notes.slice(0, 500),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('Erro ao criar pedido', {error: err.message, userId});
    throw new HttpsError('internal', 'Erro ao criar pedido. Tente novamente.');
  }

  logger.info('Pedido criado', {orderId: orderRef.id, userId, itemCount: items.length});

  return {
    success: true,
    message: 'Pedido criado com sucesso.',
    orderId: orderRef.id,
  };
});
