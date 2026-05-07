const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {db} = require('../config/firebase');
const {validateAdmin} = require('../utils/auth');

exports.getStockMovements = onCall(async (request) => {
  validateAdmin(request);

  const {productId, variantId, limit = 20, startAfterDocId} = request.data || {};

  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);

  let query = db
      .collection('stock_movements')
      .orderBy('createdAt', 'desc')
      .limit(safeLimit);

  if (productId && variantId) {
    query = db.collection('stock_movements')
        .where('productId', '==', productId)
        .where('variantId', '==', variantId)
        .orderBy('createdAt', 'desc')
        .limit(safeLimit);
  } else if (productId) {
    query = db.collection('stock_movements')
        .where('productId', '==', productId)
        .orderBy('createdAt', 'desc')
        .limit(safeLimit);
  }

  if (!productId && !variantId) {
    throw new HttpsError('invalid-argument', 'Informe ao menos productId para filtrar movimentações.');
  }

  if (startAfterDocId) {
    const cursor = await db.collection('stock_movements').doc(startAfterDocId).get();
    if (cursor.exists) {
      query = query.startAfter(cursor);
    }
  }

  const snapshot = await query.get();

  return {
    success: true,
    movements: snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()})),
    nextCursor: snapshot.docs[snapshot.docs.length - 1]?.id ?? null,
    hasMore: snapshot.docs.length === safeLimit,
  };
});
