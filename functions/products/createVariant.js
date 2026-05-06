const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const {db} = require("../config/firebase");
const {validateAdmin} = require("../utils/auth");

exports.createVariant = onCall(async (request) => {
  const {
    productId,
    sku,
    color,
    size,
    price,
    stock = 0,
    active = true,
  } = request.data;

  await validateAdmin(request);

  if (!productId || !sku || !color || !size || !price) {
    throw new HttpsError(
        "invalid-argument",
        "Dados obrigatórios da variante ausentes.",
    );
  }

  const productRef = db.collection("products").doc(productId);
  const productSnap = await productRef.get();

  if (!productSnap.exists) {
    throw new HttpsError("not-found", "Produto não encontrado.");
  }

  const variantRef = productRef.collection("variants").doc();

  await variantRef.set({
    sku,
    color,
    size,
    price,
    stock,
    active,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    message: "Variante criada com sucesso.",
    variantId: variantRef.id,
  };
});
