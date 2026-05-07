const {onCall} = require('firebase-functions/v2/https');
const {db} = require('../config/firebase');
const {validateAdmin} = require('../utils/auth');

const VALID_STATUSES = ['PENDENTE', 'PAGO', 'EM_PREPARACAO', 'EM_ENTREGA', 'FINALIZADO', 'CANCELADO'];

exports.getOrders = onCall(async (request) => {
  validateAdmin(request);

  const {status, limit = 20, startAfterDocId} = request.data || {};

  if (status && !VALID_STATUSES.includes(status)) {
    const {HttpsError} = require('firebase-functions/v2/https');
    throw new HttpsError('invalid-argument', `Status inválido. Valores aceitos: ${VALID_STATUSES.join(', ')}.`);
  }

  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);

  let query = db.collection('orders').orderBy('createdAt', 'desc');

  if (status) {
    query = db.collection('orders')
        .where('status', '==', status)
        .orderBy('createdAt', 'desc');
  }

  query = query.limit(safeLimit);

  if (startAfterDocId) {
    const cursor = await db.collection('orders').doc(startAfterDocId).get();
    if (cursor.exists) {
      query = query.startAfter(cursor);
    }
  }

  const snapshot = await query.get();

  const orders = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));

  return {
    success: true,
    orders,
    nextCursor: snapshot.docs[snapshot.docs.length - 1]?.id ?? null,
    hasMore: snapshot.docs.length === safeLimit,
  };
});
