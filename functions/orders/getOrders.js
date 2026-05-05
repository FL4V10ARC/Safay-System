const {onCall} = require("firebase-functions/v2/https");
const {db} = require("../config/firebase");
const {validateAdmin} = require("../utils/auth");

exports.getOrders = onCall(async (request) => {
  const {status, limit = 20} = request.data || {};

  await validateAdmin(request);

  let query = db.collection("orders").orderBy("createdAt", "desc").limit(limit);

  if (status) {
    query = db
        .collection("orders")
        .where("status", "==", status)
        .orderBy("createdAt", "desc")
        .limit(limit);
  }

  const snapshot = await query.get();

  const orders = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {
    success: true,
    orders,
  };
});
