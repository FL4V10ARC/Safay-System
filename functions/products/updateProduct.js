const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const {db} = require("../config/firebase");
const {validateAdmin} = require("../utils/auth");

exports.updateProduct = onCall(async (request) => {
  const {
    productId,
    name,
    description,
    categoryName,
    basePrice,
    featured,
    active,
  } = request.data;

  await validateAdmin(request);

  if (!productId) {
    throw new HttpsError("invalid-argument", "O ID do produto é obrigatório.");
  }

  const productRef = db.collection("products").doc(productId);
  const productSnap = await productRef.get();

  if (!productSnap.exists) {
    throw new HttpsError("not-found", "Produto não encontrado.");
  }

  const updateData = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (name !== undefined) {
    updateData.name = name;
  }

  if (description !== undefined) {
    updateData.description = description;
  }

  if (categoryName !== undefined) {
    updateData.categoryName = categoryName;
  }

  if (basePrice !== undefined) {
    updateData.basePrice = basePrice;
  }

  if (featured !== undefined) {
    updateData.featured = featured;
  }

  if (active !== undefined) {
    updateData.active = active;
  }

  await productRef.update(updateData);

  return {
    success: true,
    message: "Produto atualizado com sucesso.",
  };
});
