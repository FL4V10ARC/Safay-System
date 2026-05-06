const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const {db} = require("../config/firebase");

exports.createOrder = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const {
    items,
    deliveryType,
    deliveryFee = 0,
    deliveryAddress = {},
    notes = "",
  } = request.data;

  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError(
        "invalid-argument",
        "O pedido deve possuir pelo menos um item.",
    );
  }

  const userRef = db.collection("users").doc(request.auth.uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError(
        "failed-precondition",
        "Perfil do cliente não encontrado.",
    );
  }

  const user = userSnap.data();

  if (user.active !== true) {
    throw new HttpsError("permission-denied", "Usuário inativo.");
  }

  const orderItems = [];
  let total = 0;

  for (const item of items) {
    if (!item.productId || !item.variantId || !item.quantity) {
      throw new HttpsError(
          "invalid-argument",
          "Produto, variação e quantidade são obrigatórios.",
      );
    }

    if (item.quantity <= 0) {
      throw new HttpsError(
          "invalid-argument",
          "A quantidade deve ser maior que zero.",
      );
    }

    const productRef = db.collection("products").doc(item.productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      throw new HttpsError("not-found", "Produto não encontrado.");
    }

    const product = productSnap.data();

    if (product.active !== true) {
      throw new HttpsError("failed-precondition", "Produto indisponível.");
    }

    const variantRef = productRef.collection("variants").doc(item.variantId);
    const variantSnap = await variantRef.get();

    if (!variantSnap.exists) {
      throw new HttpsError("not-found", "Variante não encontrada.");
    }

    const variant = variantSnap.data();

    if (variant.active !== true) {
      throw new HttpsError("failed-precondition", "Variação indisponível.");
    }

    if (variant.stock < item.quantity) {
      throw new HttpsError("failed-precondition", "Estoque insuficiente.");
    }

    const unitPrice = variant.price;
    const subtotal = unitPrice * item.quantity;

    total += subtotal;

    orderItems.push({
      productId: item.productId,
      variantId: item.variantId,
      productName: product.name,
      color: variant.color,
      size: variant.size,
      quantity: item.quantity,
      unitPrice,
      subtotal,
    });
  }

  total += deliveryFee;

  const orderRef = db.collection("orders").doc();

  await orderRef.set({
    customerId: request.auth.uid,
    customerSnapshot: {
      name: user.name,
      email: user.email,
      phone: user.phone || "",
    },
    deliveryAddress,
    items: orderItems,
    total,
    status: "PENDENTE",
    paymentStatus: "PENDENTE",
    deliveryType: deliveryType || "RETIRADA",
    deliveryFee,
    notes,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    message: "Pedido criado com sucesso.",
    orderId: orderRef.id,
  };
});
