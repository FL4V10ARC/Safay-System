const admin = require("firebase-admin");

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

admin.initializeApp({
  projectId: "safay-system",
});

const db = admin.firestore();
/**
 * Popula o Firestore Emulator com dados iniciais.
 */
async function seed() {
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
  console.log("productId:", productRef.id);
  console.log("variantId:", variantRef.id);
  console.log("orderId:", orderRef.id);
}

seed().catch((error) => {
  console.error("Erro ao executar seed:", error);
});
