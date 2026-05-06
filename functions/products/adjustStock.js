const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const {db} = require("../config/firebase");
const {validateAdmin} = require("../utils/auth");

exports.adjustStock = onCall(async (request) => {
  const {
    productId,
    variantId,
    quantity,
    type,
    reason = "MANUAL_ADJUSTMENT",
  } = request.data;

  await validateAdmin(request);

  if (!productId || !variantId || !quantity || !type) {
    throw new HttpsError(
        "invalid-argument",
        "Produto, variante, quantidade e tipo são obrigatórios.",
    );
  }

  if (!["IN", "OUT", "ADJUSTMENT"].includes(type)) {
    throw new HttpsError(
        "invalid-argument",
        "Tipo de movimentação inválido.",
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

  const variant = variantSnap.data();

  let newStock;

  if (type === "IN") {
    newStock = variant.stock + quantity;
  }

  if (type === "OUT") {
    if (variant.stock < quantity) {
      throw new HttpsError(
          "failed-precondition",
          "Estoque insuficiente para saída.",
      );
    }

    newStock = variant.stock - quantity;
  }

  if (type === "ADJUSTMENT") {
    if (quantity < 0) {
      throw new HttpsError(
          "invalid-argument",
          "O estoque ajustado não pode ser negativo.",
      );
    }

    newStock = quantity;
  }

  const batch = db.batch();

  batch.update(variantRef, {
    stock: newStock,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const movementRef = db.collection("stock_movements").doc();

  batch.set(movementRef, {
    productId,
    variantId,
    type,
    reason,
    quantity,
    previousStock: variant.stock,
    newStock,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {
    success: true,
    message: "Estoque ajustado com sucesso.",
    previousStock: variant.stock,
    newStock,
  };
});
