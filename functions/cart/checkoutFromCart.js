const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const {db} = require("../config/firebase");

exports.checkoutFromCart = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const {
    deliveryType = "RETIRADA",
    deliveryFee = 0,
    deliveryAddress = {},
    notes = "",
  } = request.data || {};

  const userRef = db.collection("users").doc(request.auth.uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError(
        "failed-precondition",
        "Perfil do cliente não encontrado.",
    );
  }

  const cartRef = db.collection("carts").doc(request.auth.uid);
  const cartSnap = await cartRef.get();

  if (!cartSnap.exists || !(cartSnap.data().items || []).length) {
    throw new HttpsError("failed-precondition", "Carrinho vazio.");
  }

  const user = userSnap.data();
  const cartItems = cartSnap.data().items;

  const orderItems = [];
  let total = 0;

  for (const item of cartItems) {
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

    const subtotal = variant.price * item.quantity;
    total += subtotal;

    orderItems.push({
      productId: item.productId,
      variantId: item.variantId,
      productName: product.name,
      color: variant.color,
      size: variant.size,
      quantity: item.quantity,
      unitPrice: variant.price,
      subtotal,
    });
  }

  total += deliveryFee;

  const batch = db.batch();

  const orderRef = db.collection("orders").doc();

  batch.set(orderRef, {
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
    deliveryType,
    deliveryFee,
    notes,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(
      cartRef,
      {
        userId: request.auth.uid,
        items: [],
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
  );

  await batch.commit();

  return {
    success: true,
    message: "Checkout realizado com sucesso.",
    orderId: orderRef.id,
  };
});
