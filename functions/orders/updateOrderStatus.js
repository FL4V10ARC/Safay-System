const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const {db} = require("../config/firebase");
const {validateAdmin} = require("../utils/auth");

exports.updateOrderStatus = onCall(async (request) => {
  const {orderId, status} = request.data;

  await validateAdmin(request);

  const allowedStatus = ["PAGO", "EM_PREPARACAO", "EM_ENTREGA", "FINALIZADO"];

  if (!allowedStatus.includes(status)) {
    throw new HttpsError("invalid-argument", "Status inválido.");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Pedido não encontrado.");
  }

  const order = orderSnap.data();

  if (order.status === "CANCELADO") {
    throw new HttpsError(
        "failed-precondition",
        "Pedidos cancelados não podem ser atualizados.",
    );
  }

  if (order.status === "FINALIZADO") {
    throw new HttpsError(
        "failed-precondition",
        "Pedidos finalizados não podem ser atualizados.",
    );
  }

  await orderRef.update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    message: "Status do pedido atualizado com sucesso.",
  };
});
