const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {db} = require('../config/firebase');
const {validateAdmin} = require('../utils/auth');

exports.getOrderById = onCall(async (request) => {
  const {orderId} = request.data;

  await validateAdmin(request);

  if (!orderId) {
    throw new HttpsError('invalid-argument', 'O ID do pedido é obrigatório.');
  }

  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new HttpsError('not-found', 'Pedido não encontrado.');
  }

  return {
    success: true,
    order: {
      id: orderSnap.id,
      ...orderSnap.data(),
    },
  };
});
