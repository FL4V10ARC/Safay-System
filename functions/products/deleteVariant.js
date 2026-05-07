const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {FieldValue} = require('firebase-admin/firestore');
const {db} = require('../config/firebase');
const {validateAdmin} = require('../utils/auth');

exports.deleteVariant = onCall(async (request) => {
  const {productId, variantId} = request.data;

  await validateAdmin(request);

  if (!productId || !variantId) {
    throw new HttpsError(
        'invalid-argument',
        'Produto e variante são obrigatórios.',
    );
  }

  const variantRef = db
      .collection('products')
      .doc(productId)
      .collection('variants')
      .doc(variantId);

  const variantSnap = await variantRef.get();

  if (!variantSnap.exists) {
    throw new HttpsError('not-found', 'Variante não encontrada.');
  }

  await variantRef.update({
    active: false,
    deletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    message: 'Variante desativada com sucesso.',
  };
});
