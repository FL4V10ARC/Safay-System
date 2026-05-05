const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {db} = require("../config/firebase");

exports.getOrdersByPhone = onCall(async (request) => {
  const {phone} = request.data;

  if (!phone) {
    throw new HttpsError("invalid-argument", "O telefone é obrigatório.");
  }

  const snapshot = await db
      .collection("orders")
      .where("customer.phone", "==", phone)
      .orderBy("createdAt", "desc")
      .get();

  const orders = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {
    success: true,
    orders,
  };
});
