const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {FieldValue} = require('firebase-admin/firestore');
const {db} = require('../config/firebase');
const {validateAdmin} = require('../utils/auth');
const logger = require('firebase-functions/logger');

exports.confirmOrder = onCall(async (request) => {
  await validateAdmin(request);

  const {orderId} = request.data;

  if (!orderId) {
    throw new HttpsError('invalid-argument', 'ID do pedido é obrigatório.');
  }

  const orderRef = db.collection('orders').doc(orderId);

  try {
    await db.runTransaction(async (transaction) => {
      // Lê o pedido DENTRO da transaction — evita confirmação duplicada
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new HttpsError('not-found', 'Pedido não encontrado.');
      }

      if (orderDoc.data().status !== 'PENDENTE') {
        throw new HttpsError('failed-precondition', 'Pedido já processado.');
      }

      const order = orderDoc.data();

      for (const item of order.items) {
        const variantRef = db
            .collection('products')
            .doc(item.productId)
            .collection('variants')
            .doc(item.variantId);

        // Leitura de estoque DENTRO da transaction
        const variantDoc = await transaction.get(variantRef);

        if (!variantDoc.exists) {
          throw new HttpsError('not-found', `Variante ${item.variantId} não encontrada.`);
        }

        const currentStock = variantDoc.data().stock ?? 0;

        if (currentStock < item.quantity) {
          throw new HttpsError(
              'failed-precondition',
              `Estoque insuficiente para "${item.productName}". Disponível: ${currentStock}.`,
          );
        }

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
          reason: 'ORDER_CONFIRMED',
          quantity: item.quantity,
          previousStock: currentStock,
          newStock,
          orderId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      transaction.update(orderRef, {
        status: 'PAGO',
        paymentStatus: 'CONFIRMADO',
        confirmedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('Erro ao confirmar pedido', {error: err.message, orderId});
    throw new HttpsError('internal', 'Erro ao confirmar pedido. Tente novamente.');
  }

  logger.info('Pedido confirmado', {orderId, adminId: request.auth.uid});

  return {success: true, message: 'Pedido confirmado com sucesso.'};
});
