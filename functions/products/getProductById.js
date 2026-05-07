const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {db} = require('../config/firebase');

exports.getProductById = onCall(async (request) => {
  const {productId} = request.data;

  if (!productId) {
    throw new HttpsError('invalid-argument', 'O ID do produto é obrigatório.');
  }

  const productRef = db.collection('products').doc(productId);
  const productSnap = await productRef.get();

  if (!productSnap.exists) {
    throw new HttpsError('not-found', 'Produto não encontrado.');
  }

  const product = productSnap.data();

  if (product.active !== true) {
    throw new HttpsError('failed-precondition', 'Produto indisponível.');
  }

  const variantsSnapshot = await productRef
      .collection('variants')
      .where('active', '==', true)
      .get();

  const variants = variantsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {
    success: true,
    product: {
      id: productSnap.id,
      ...product,
      variants,
    },
  };
});
