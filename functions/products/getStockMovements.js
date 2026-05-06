const {onCall} = require("firebase-functions/v2/https");
const {db} = require("../config/firebase");
const {validateAdmin} = require("../utils/auth");

exports.getStockMovements = onCall(async (request) => {
  const {productId, variantId, limit = 20} = request.data || {};

  await validateAdmin(request);

  let query = db
      .collection("stock_movements")
      .orderBy("createdAt", "desc")
      .limit(limit);

  if (productId) {
    query = query.where("productId", "==", productId);
  }

  if (variantId) {
    query = query.where("variantId", "==", variantId);
  }

  const snapshot = await query.get();

  const movements = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {
    success: true,
    movements,
  };
});
