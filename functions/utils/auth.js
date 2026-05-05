const {HttpsError} = require("firebase-functions/v2/https");
const {db} = require("../config/firebase");

/**
 * Valida se o usuário autenticado é administrador.
 * @param {object} request Requisição da Cloud Function.
 * @return {Promise<object>} Dados do usuário admin.
 */
async function validateAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const userDoc = await db.collection("users").doc(request.auth.uid).get();

  if (!userDoc.exists) {
    throw new HttpsError("permission-denied", "Usuário não encontrado.");
  }

  const user = userDoc.data();

  if (user.role !== "ADMIN" || user.active !== true) {
    throw new HttpsError(
        "permission-denied",
        "Apenas administradores podem executar esta ação.",
    );
  }

  return user;
}

module.exports = {
  validateAdmin,
};
