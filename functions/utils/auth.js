const {HttpsError} = require('firebase-functions/v2/https');

/**
 * Valida se o usuário autenticado é administrador via Custom Claim.
 * Zero leituras de banco — verificação instantânea no JWT.
 * @param {object} request Requisição da Cloud Function.
 */
function validateAdmin(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  if (request.auth.token.role !== 'ADMIN') {
    throw new HttpsError(
        'permission-denied',
        'Apenas administradores podem executar esta ação.',
    );
  }
}

module.exports = {validateAdmin};
