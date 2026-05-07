const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {db} = require('../config/firebase');

exports.getCart = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const cartRef = db.collection('carts').doc(request.auth.uid);
  const cartSnap = await cartRef.get();

  if (!cartSnap.exists) {
    return {
      success: true,
      items: [],
    };
  }

  return {
    success: true,
    ...cartSnap.data(),
  };
});
