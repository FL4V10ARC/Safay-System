/* eslint-disable */
const admin = require("firebase-admin");

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

admin.initializeApp({
  projectId: "safay-system",
});

const db = admin.firestore();

/**
 * Cria usuário admin no Auth Emulator e Firestore.
 * @return {Promise<Object>}
 */
async function createAdminUser() {
  const email = "admin@safay.com";
  const password = "123456";

  let user;

  try {
    user = await admin.auth().createUser({
      email,
      password,
      displayName: "Admin",
    });
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      user = await admin.auth().getUserByEmail(email);
    } else {
      throw error;
    }
  }

  await admin.auth().setCustomUserClaims(user.uid, {
    role: "ADMIN",
  });

  await db.collection("users").doc(user.uid).set({
    name: "Admin",
    email,
    role: "ADMIN",
    active: true,
    provider: "email_password",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return user;
}

/**
 * Cria usuário cliente no Auth Emulator e Firestore.
 * @return {Promise<Object>}
 */
async function createCustomerUser() {
  const email = "cliente@safay.com";
  const password = "123456";

  let user;

  try {
    user = await admin.auth().createUser({
      email,
      password,
      displayName: "Cliente Teste",
    });
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      user = await admin.auth().getUserByEmail(email);
    } else {
      throw error;
    }
  }

  await db.collection("users").doc(user.uid).set({
    name: "Cliente Teste",
    email,
    phone: "92999999999",
    role: "CUSTOMER",
    active: true,
    provider: "email_password",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return user;
}

/**
 * Popula o Firestore Emulator com dados iniciais.
 */
async function seed() {
  const adminUser = await createAdminUser();
  const customerUser = await createCustomerUser();

  const productRef = db.collection("products").doc();

  await productRef.set({
    name: "Vestido Indiano",
    description: "Vestido estampado feminino",
    categoryName: "Vestidos",
    basePrice: 149.99,
    featured: true,
    active: true,
    coverImage: "",
    gallery: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const variantRef = productRef.collection("variants").doc();

  await variantRef.set({
    sku: "VEST-IND-AZUL-M",
    color: "Azul",
    size: "M",
    price: 149.99,
    stock: 3,
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const orderRef = db.collection("orders").doc();

  await orderRef.set({
    customerId: customerUser.uid,
    customerSnapshot: {
      name: "Cliente Teste",
      email: "cliente@safay.com",
      phone: "92999999999",
    },
    status: "PENDENTE",
    paymentStatus: "PENDENTE",
    total: 149.99,
    deliveryType: "RETIRADA",
    deliveryFee: 0,
    deliveryAddress: {},
    notes: "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    items: [
      {
        productId: productRef.id,
        variantId: variantRef.id,
        quantity: 1,
        productName: "Vestido Indiano",
      },
    ],
  });

  console.log("Seed criado com sucesso!");

  console.log("adminEmail:", "admin@safay.com");
  console.log("adminPassword:", "123456");
  console.log("adminUid:", adminUser.uid);

  console.log("customerEmail:", "cliente@safay.com");
  console.log("customerPassword:", "123456");
  console.log("customerUid:", customerUser.uid);

  console.log("productId:", productRef.id);
  console.log("variantId:", variantRef.id);
  console.log("orderId:", orderRef.id);
}

seed().catch((error) => {
  console.error("Erro ao executar seed:", error);
});
