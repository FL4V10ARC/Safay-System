const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const {db} = require("../config/firebase");
const {validateAdmin} = require("../utils/auth");

exports.createProduct = onCall(async (request) => {
  const {
    name,
    description = "",
    categoryName,
    basePrice,
    featured = false,
    active = true,
    coverImage = "",
    gallery = [],
    variants,
  } = request.data;

  await validateAdmin(request);

  if (!name || !categoryName || !basePrice) {
    throw new HttpsError(
        "invalid-argument",
        "Nome, categoria e preço base são obrigatórios.",
    );
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    throw new HttpsError(
        "invalid-argument",
        "O produto precisa ter pelo menos uma variante.",
    );
  }

  const productRef = db.collection("products").doc();

  await productRef.set({
    name,
    description,
    categoryName,
    basePrice,
    featured,
    active,
    coverImage,
    gallery,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const batch = db.batch();

  for (const variant of variants) {
    if (!variant.sku || !variant.color || !variant.size || !variant.price) {
      throw new HttpsError(
          "invalid-argument",
          "SKU, cor, tamanho e preço são obrigatórios.",
      );
    }

    const variantRef = productRef.collection("variants").doc();

    batch.set(variantRef, {
      sku: variant.sku,
      color: variant.color,
      size: variant.size,
      price: variant.price,
      stock: variant.stock || 0,
      active: variant.active !== false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  return {
    success: true,
    message: "Produto criado com sucesso.",
    productId: productRef.id,
  };
});
