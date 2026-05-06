const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const {db} = require("../config/firebase");
const {validateAdmin} = require("../utils/auth");

exports.deleteProduct = onCall(async (request) => {
  const {productId} = request.data;

  await validateAdmin(request);

  if (!productId) {
    throw new HttpsError("invalid-argument", "O ID do produto é obrigatório.");
  }

  const productRef = db.collection("products").doc(productId);
  const productSnap = await productRef.get();

  if (!productSnap.exists) {
    throw new HttpsError("not-found", "Produto não encontrado.");
  }

  await productRef.update({
    active: false,
    deletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    message: "Produto desativado com sucesso.",
  };
});
