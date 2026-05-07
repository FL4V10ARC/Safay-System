const {onCall} = require('firebase-functions/v2/https');
const {db} = require('../config/firebase');

exports.getProducts = onCall(async (request) => {
  const {
    categoryName,
    featured,
    active = true,
    limit = 20,
    startAfterDocId,
  } = request.data || {};

  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);

  let query = db
      .collection('products')
      .where('active', '==', active)
      .orderBy('createdAt', 'desc')
      .limit(safeLimit);

  if (categoryName) {
    query = query.where('categoryName', '==', categoryName);
  }

  if (featured === true) {
    query = query.where('featured', '==', true);
  }

  if (startAfterDocId) {
    const cursor = await db.collection('products').doc(startAfterDocId).get();
    if (cursor.exists) {
      query = query.startAfter(cursor);
    }
  }

  const snapshot = await query.get();

  // Busca todas as variantes em paralelo — não sequencial (N+1 eliminado)
  const variantPromises = snapshot.docs.map((doc) =>
    db
        .collection('products')
        .doc(doc.id)
        .collection('variants')
        .where('active', '==', true)
        .get(),
  );

  const variantSnapshots = await Promise.all(variantPromises);

  const products = snapshot.docs.map((doc, i) => ({
    id: doc.id,
    ...doc.data(),
    variants: variantSnapshots[i].docs.map((v) => ({id: v.id, ...v.data()})),
  }));

  return {
    success: true,
    products,
    nextCursor: snapshot.docs[snapshot.docs.length - 1]?.id ?? null,
    hasMore: snapshot.docs.length === safeLimit,
  };
});
