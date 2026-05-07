const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {FieldValue} = require('firebase-admin/firestore');
const {db} = require('../config/firebase');
const {validateAdmin} = require('../utils/auth');
const logger = require('firebase-functions/logger');

// State machine explícita — define quais transições são válidas
const VALID_TRANSITIONS = {
  'PENDENTE': ['PAGO', 'CANCELADO'],
  'PAGO': ['EM_PREPARACAO', 'CANCELADO'],
  'EM_PREPARACAO': ['EM_ENTREGA'],
  'EM_ENTREGA': ['FINALIZADO'],
  'FINALIZADO': [], // terminal
  'CANCELADO': [], // terminal
};

exports.updateOrderStatus = onCall(async (request) => {
  validateAdmin(request);

  const {orderId, status} = request.data;

  if (!orderId || !status) {
    throw new HttpsError('invalid-argument', 'ID do pedido e status são obrigatórios.');
  }

  const allStatuses = Object.keys(VALID_TRANSITIONS);
  if (!allStatuses.includes(status)) {
    throw new HttpsError('invalid-argument', `Status inválido. Valores aceitos: ${allStatuses.join(', ')}.`);
  }

  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new HttpsError('not-found', 'Pedido não encontrado.');
  }

  const currentStatus = orderSnap.data().status;
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] ?? [];

  if (!allowedTransitions.includes(status)) {
    throw new HttpsError(
        'failed-precondition',
        `Não é possível alterar de "${currentStatus}" para "${status}". ` +
        `Transições permitidas: ${allowedTransitions.join(', ') || 'nenhuma (status terminal)'}.`,
    );
  }

  await orderRef.update({
    status,
    [`statusHistory.${status}`]: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info('Status do pedido atualizado', {
    orderId,
    from: currentStatus,
    to: status,
    adminId: request.auth.uid,
  });

  return {success: true, message: 'Status do pedido atualizado com sucesso.'};
});
