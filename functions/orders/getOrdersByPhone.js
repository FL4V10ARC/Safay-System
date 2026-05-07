const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {db} = require('../config/firebase');
const {validateAdmin} = require('../utils/auth');
const logger = require('firebase-functions/logger');

exports.getOrdersByPhone = onCall(async (request) => {
  // Apenas ADMIN pode buscar pedidos por telefone
  validateAdmin(request);

  const {phone, limit = 20} = request.data;

  if (!phone || typeof phone !== 'string') {
    throw new HttpsError('invalid-argument', 'Telefone é obrigatório.');
  }

  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);

  // Campo correto: customerSnapshot.phone (corrigido de customer.phone)
  const snapshot = await db
      .collection('orders')
      .where('customerSnapshot.phone', '==', phone.trim())
      .orderBy('createdAt', 'desc')
      .limit(safeLimit)
      .get();

  const orders = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  logger.info('Busca de pedidos por telefone', {
    phone: phone.slice(0, 4) + '****',
    resultCount: orders.length,
    adminId: request.auth.uid,
  });

  return {success: true, orders};
});
