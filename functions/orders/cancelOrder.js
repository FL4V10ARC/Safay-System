const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {FieldValue} = require('firebase-admin/firestore');
const {db} = require('../config/firebase');
const {validateAdmin} = require('../utils/auth');
const logger = require('firebase-functions/logger');

// Transições válidas de status — pedido só pode ser cancelado de estados não-terminais
const CANCELABLE_STATUSES = ['PENDENTE', 'PAGO', 'EM_PREPARACAO'];

exports.cancelOrder = onCall(async (request) => {
  await validateAdmin(request);

  const {orderId} = request.data;

  if (!orderId) {
    throw new HttpsError('invalid-argument', 'ID do pedido é obrigatório.');
  }

  const orderRef = db.collection('orders').doc(orderId);

  try {
    await db.runTransaction(async (transaction) => {
      // Leitura DENTRO da transaction — evita cancelamento duplo
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new HttpsError('not-found', 'Pedido não encontrado.');
      }

      const order = orderDoc.data();

      if (!CANCELABLE_STATUSES.includes(order.status)) {
        throw new HttpsError(
            'failed-precondition',
            `Pedido com status "${order.status}" não pode ser cancelado.`,
        );
      }

      // Só devolve estoque se o pedido já tinha estoque debitado (status PAGO ou posterior)
      const shouldRestoreStock = ['PAGO', 'EM_PREPARACAO'].includes(order.status);

      if (shouldRestoreStock) {
        for (const item of order.items) {
          const variantRef = db
              .collection('products')
              .doc(item.productId)
              .collection('variants')
              .doc(item.variantId);

          const variantDoc = await transaction.get(variantRef);

          if (!variantDoc.exists) {
            // Variante deletada — registra movimento mas não falha
            logger.warn('Variante não encontrada ao cancelar pedido', {
              variantId: item.variantId,
              orderId,
            });
            continue;
          }

          const currentStock = variantDoc.data().stock ?? 0;
          const newStock = currentStock + item.quantity;

          transaction.update(variantRef, {
            stock: newStock,
            updatedAt: FieldValue.serverTimestamp(),
          });

          const movementRef = db.collection('stock_movements').doc();
          transaction.set(movementRef, {
            productId: item.productId,
            variantId: item.variantId,
            type: 'IN',
            reason: 'ORDER_CANCELED',
            quantity: item.quantity,
            previousStock: currentStock,
            newStock,
            orderId,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }

      transaction.update(orderRef, {
        status: 'CANCELADO',
        canceledAt: FieldValue.serverTimestamp(),
        canceledBy: request.auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('Erro ao cancelar pedido', {error: err.message, orderId});
    throw new HttpsError('internal', 'Erro ao cancelar pedido. Tente novamente.');
  }

  logger.info('Pedido cancelado', {orderId, adminId: request.auth.uid});

  return {success: true, message: 'Pedido cancelado com sucesso.'};
});
