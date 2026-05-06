const {onCall} = require("firebase-functions/v2/https");
const {db} = require("../config/firebase");

exports.getProducts = onCall(async (request) => {
  const {
    categoryName,
    featured,
    active = true,
    limit = 20,
  } = request.data || {};

  let query = db
      .collection("products")
      .where("active", "==", active)
      .limit(limit);

  if (categoryName) {
    query = query.where("categoryName", "==", categoryName);
  }

  if (featured === true) {
    query = query.where("featured", "==", true);
  }

  const snapshot = await query.get();

  const products = [];

  for (const doc of snapshot.docs) {
    const product = doc.data();

    const variantsSnapshot = await db
        .collection("products")
        .doc(doc.id)
        .collection("variants")
        .where("active", "==", true)
        .get();

    const variants = variantsSnapshot.docs.map((variantDoc) => ({
      id: variantDoc.id,
      ...variantDoc.data(),
    }));

    products.push({
      id: doc.id,
      ...product,
      variants,
    });
  }

  return {
    success: true,
    products,
  };
});
