const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {FieldValue} = require('firebase-admin/firestore');
const {db} = require('../config/firebase');

exports.clearCart = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const cartRef = db.collection('carts').doc(request.auth.uid);

  await cartRef.set(
      {
        userId: request.auth.uid,
        items: [],
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
  );

  return {
    success: true,
    message: 'Carrinho limpo com sucesso.',
  };
});
