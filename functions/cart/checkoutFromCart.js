const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {FieldValue} = require('firebase-admin/firestore');
const {db} = require('../config/firebase');
const logger = require('firebase-functions/logger');

exports.checkoutFromCart = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const {
    deliveryType = 'RETIRADA',
    deliveryFee = 0,
    deliveryAddress = {},
    notes = '',
  } = request.data || {};

  if (typeof deliveryFee !== 'number' || deliveryFee < 0) {
    throw new HttpsError('invalid-argument', 'Taxa de entrega inválida.');
  }

  if (!['RETIRADA', 'ENTREGA'].includes(deliveryType)) {
    throw new HttpsError('invalid-argument', 'Tipo de entrega inválido.');
  }

  const userId = request.auth.uid;
  const userRef = db.collection('users').doc(userId);
  const cartRef = db.collection('carts').doc(userId);

  const [userSnap, cartSnap] = await Promise.all([
    userRef.get(),
    cartRef.get(),
  ]);

  if (!userSnap.exists) {
    throw new HttpsError('failed-precondition', 'Perfil do cliente não encontrado.');
  }

  if (!cartSnap.exists || !(cartSnap.data().items || []).length) {
    throw new HttpsError('failed-precondition', 'Carrinho vazio.');
  }

  const user = userSnap.data();
  const cartItems = cartSnap.data().items;

  if (user.active !== true) {
    throw new HttpsError('permission-denied', 'Usuário inativo.');
  }

  const orderRef = db.collection('orders').doc();

  try {
    await db.runTransaction(async (transaction) => {
      const orderItems = [];
      let total = 0;

      for (const item of cartItems) {
        if (!item.productId || !item.variantId || !item.quantity || item.quantity <= 0) {
          throw new HttpsError('invalid-argument', 'Item do carrinho inválido.');
        }

        const productRef = db.collection('products').doc(item.productId);
        const variantRef = productRef.collection('variants').doc(item.variantId);

        // Leituras DENTRO da transaction — garante consistência total
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

        // Decrementa estoque atomicamente dentro da transaction
        transaction.update(variantRef, {
          stock: newStock,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Registra movimentação dentro da mesma transaction
        const movementRef = db.collection('stock_movements').doc();
        transaction.set(movementRef, {
          productId: item.productId,
          variantId: item.variantId,
          type: 'OUT',
          reason: 'CHECKOUT',
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

      // Limpa o carrinho na mesma transaction
      transaction.set(cartRef, {
        userId,
        items: [],
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('Erro no checkout', {error: err.message, userId});
    throw new HttpsError('internal', 'Erro ao processar checkout. Tente novamente.');
  }

  logger.info('Checkout realizado', {orderId: orderRef.id, userId, itemCount: cartItems.length});

  return {
    success: true,
    message: 'Checkout realizado com sucesso.',
    orderId: orderRef.id,
  };
});
