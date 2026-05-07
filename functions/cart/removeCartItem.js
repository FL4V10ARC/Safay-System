const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {FieldValue} = require('firebase-admin/firestore');
const {db} = require('../config/firebase');

exports.removeCartItem = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const {productId, variantId} = request.data || {};

  if (!productId || !variantId) {
    throw new HttpsError(
        'invalid-argument',
        'Produto e variante são obrigatórios.',
    );
  }

  const cartRef = db.collection('carts').doc(request.auth.uid);
  const cartSnap = await cartRef.get();

  if (!cartSnap.exists) {
    return {
      success: true,
      message: 'Carrinho já está vazio.',
      items: [],
    };
  }

  const currentItems = cartSnap.data().items || [];

  const items = currentItems.filter(
      (item) => !(item.productId === productId && item.variantId === variantId),
  );

  await cartRef.set(
      {
        userId: request.auth.uid,
        items,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
  );

  return {
    success: true,
    message: 'Item removido do carrinho com sucesso.',
    items,
  };
});
