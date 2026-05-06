const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const {db} = require("../config/firebase");
const {validateAdmin} = require("../utils/auth");

exports.updateVariant = onCall(async (request) => {
  const {productId, variantId, sku, color, size, price, stock, active} =
    request.data;

  await validateAdmin(request);

  if (!productId || !variantId) {
    throw new HttpsError(
        "invalid-argument",
        "ID do produto e ID da variante são obrigatórios.",
    );
  }

  const variantRef = db
      .collection("products")
      .doc(productId)
      .collection("variants")
      .doc(variantId);

  const variantSnap = await variantRef.get();

  if (!variantSnap.exists) {
    throw new HttpsError("not-found", "Variante não encontrada.");
  }

  const updateData = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (sku !== undefined) updateData.sku = sku;
  if (color !== undefined) updateData.color = color;
  if (size !== undefined) updateData.size = size;
  if (price !== undefined) updateData.price = price;
  if (stock !== undefined) updateData.stock = stock;
  if (active !== undefined) updateData.active = active;

  await variantRef.update(updateData);

  return {
    success: true,
    message: "Variante atualizada com sucesso.",
  };
});
