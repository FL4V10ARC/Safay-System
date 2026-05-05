const admin = require("firebase-admin");

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

admin.initializeApp({
  projectId: "safay-system",
});

const db = admin.firestore();

/**
 * Cria usuário admin no Auth Emulator e no Firestore Emulator.
 * @return {Promise<string>} UID do admin criado.
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

  await db.collection("users").doc(user.uid).set({
    name: "Admin",
    email,
    role: "ADMIN",
    active: true,
  });

  return user.uid;
}

/**
 * Popula o Firestore Emulator com dados iniciais.
 */
async function seed() {
  const adminUid = await createAdminUser();

  const productRef = db.collection("products").doc();

  await productRef.set({
    name: "Vestido Indiano",
    description: "Vestido estampado feminino",
    categoryName: "Vestidos",
    basePrice: 149.99,
    featured: true,
    active: true,
  });

  const variantRef = productRef.collection("variants").doc();

  await variantRef.set({
    sku: "VEST-IND-AZUL-M",
    color: "Azul",
    size: "M",
    price: 149.99,
    stock: 3,
    active: true,
  });

  const orderRef = db.collection("orders").doc();

  await orderRef.set({
    status: "PENDENTE",
    paymentStatus: "PENDENTE",
    total: 149.99,
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
  console.log("adminEmail: admin@safay.com");
  console.log("adminPassword: 123456");
  console.log("adminUid:", adminUid);
  console.log("productId:", productRef.id);
  console.log("variantId:", variantRef.id);
  console.log("orderId:", orderRef.id);
}

seed().catch((error) => {
  console.error("Erro ao executar seed:", error);
});
