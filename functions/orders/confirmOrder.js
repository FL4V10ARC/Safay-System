const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const {db} = require("../config/firebase");
const {validateAdmin} = require("../utils/auth");

exports.confirmOrder = onCall(async (request) => {
  const {orderId} = request.data;

  await validateAdmin(request);

  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Pedido não encontrado.");
  }

  const order = orderSnap.data();

  if (order.status !== "PENDENTE") {
    throw new HttpsError("failed-precondition", "Pedido já processado.");
  }

  const batch = db.batch();

  for (const item of order.items) {
    const variantRef = db
        .collection("products")
        .doc(item.productId)
        .collection("variants")
        .doc(item.variantId);

    const variantSnap = await variantRef.get();

    if (!variantSnap.exists) {
      throw new HttpsError("not-found", "Variante não encontrada.");
    }

    const variant = variantSnap.data();

    if (variant.stock < item.quantity) {
      throw new HttpsError("failed-precondition", "Estoque insuficiente.");
    }

    const newStock = variant.stock - item.quantity;

    batch.update(variantRef, {
      stock: newStock,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const movementRef = db.collection("stock_movements").doc();

    batch.set(movementRef, {
      productId: item.productId,
      variantId: item.variantId,
      type: "OUT",
      reason: "ORDER_CONFIRMED",
      quantity: item.quantity,
      previousStock: variant.stock,
      newStock: newStock,
      orderId,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  batch.update(orderRef, {
    status: "PAGO",
    paymentStatus: "CONFIRMADO",
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {
    success: true,
    message: "Pedido confirmado com sucesso.",
  };
});
