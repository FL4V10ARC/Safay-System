const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

exports.confirmOrder = onCall(async (request) => {
  const {orderId} = request.data;

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const userDoc = await db.collection("users").doc(request.auth.uid).get();

  if (!userDoc.exists) {
    throw new HttpsError("permission-denied", "Usuário não encontrado.");
  }

  const user = userDoc.data();

  if (user.role !== "ADMIN") {
    throw new HttpsError(
        "permission-denied",
        "Apenas administradores podem confirmar pedidos.",
    );
  }

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
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
      orderId: orderId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  batch.update(orderRef, {
    status: "PAGO",
    paymentStatus: "CONFIRMADO",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {
    success: true,
    message: "Pedido confirmado com sucesso.",
  };
});
