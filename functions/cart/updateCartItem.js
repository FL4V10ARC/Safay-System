const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const {db} = require("../config/firebase");

exports.updateCartItem = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const {productId, variantId, quantity} = request.data || {};

  if (!productId || !variantId || !quantity) {
    throw new HttpsError(
        "invalid-argument",
        "Produto, variante e quantidade são obrigatórios.",
    );
  }

  if (quantity <= 0) {
    throw new HttpsError(
        "invalid-argument",
        "A quantidade deve ser maior que zero.",
    );
  }

  const cartRef = db.collection("carts").doc(request.auth.uid);
  const cartSnap = await cartRef.get();

  let items = [];

  if (cartSnap.exists) {
    items = cartSnap.data().items || [];
  }

  const existingItemIndex = items.findIndex(
      (item) => item.productId === productId && item.variantId === variantId,
  );

  if (existingItemIndex >= 0) {
    items[existingItemIndex].quantity = quantity;
  } else {
    items.push({
      productId,
      variantId,
      quantity,
    });
  }

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
    message: "Item do carrinho atualizado com sucesso.",
    items,
  };
});
