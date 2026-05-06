const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../config/firebase");

exports.syncCustomerProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const {
    name = "",
    email = "",
    phone = "",
    photoURL = "",
    provider = "email_password",
  } = request.data || {};

  if (!name && !email && !phone) {
    throw new HttpsError(
      "invalid-argument",
      "Informe pelo menos nome, e-mail ou telefone.",
    );
  }

  const userRef = db.collection("users").doc(request.auth.uid);
  const userSnap = await userRef.get();

  const profileData = {
    name,
    email,
    phone,
    photoURL,
    provider,
    active: true,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (userSnap.exists) {
    await userRef.update(profileData);
  } else {
    await userRef.set({
      ...profileData,
      role: "CUSTOMER",
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return {
    success: true,
    message: "Perfil sincronizado com sucesso.",
  };
});
