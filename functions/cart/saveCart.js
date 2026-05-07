const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {FieldValue} = require('firebase-admin/firestore');
const {db} = require('../config/firebase');

exports.saveCart = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const {items = []} = request.data || {};

  if (!Array.isArray(items)) {
    throw new HttpsError(
        'invalid-argument',
        'Os itens do carrinho devem ser uma lista.',
    );
  }

  for (const item of items) {
    if (!item.productId || !item.variantId || !item.quantity) {
      throw new HttpsError(
          'invalid-argument',
          'Cada item precisa ter produto, variante e quantidade.',
      );
    }

    if (item.quantity <= 0) {
      throw new HttpsError(
          'invalid-argument',
          'A quantidade deve ser maior que zero.',
      );
    }
  }

  const cartRef = db.collection('carts').doc(request.auth.uid);

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
    message: 'Carrinho salvo com sucesso.',
  };
});
