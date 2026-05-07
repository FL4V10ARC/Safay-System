const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {FieldValue} = require('firebase-admin/firestore');
const {db, admin} = require('../config/firebase');
const logger = require('firebase-functions/logger');

const ALLOWED_PROVIDERS = ['email_password', 'google.com'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-+()]{7,20}$/;

exports.syncCustomerProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const {
    name = '',
    email = '',
    phone = '',
    photoURL = '',
    provider = 'email_password',
  } = request.data || {};

  // Validação de tipos e formatos
  if (name && (typeof name !== 'string' || name.trim().length === 0)) {
    throw new HttpsError('invalid-argument', 'Nome inválido.');
  }

  if (email && !EMAIL_REGEX.test(email)) {
    throw new HttpsError('invalid-argument', 'E-mail inválido.');
  }

  if (phone && !PHONE_REGEX.test(phone)) {
    throw new HttpsError('invalid-argument', 'Telefone inválido.');
  }

  if (!ALLOWED_PROVIDERS.includes(provider)) {
    throw new HttpsError('invalid-argument', 'Provedor de autenticação inválido.');
  }

  if (!name && !email && !phone) {
    throw new HttpsError('invalid-argument', 'Informe pelo menos nome, e-mail ou telefone.');
  }

  const userId = request.auth.uid;
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  // Apenas campos seguros — nunca aceitar role/active do cliente
  const profileData = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (name) profileData.name = name.trim().slice(0, 100);
  if (email) profileData.email = email.toLowerCase().trim();
  if (phone) profileData.phone = phone.trim().slice(0, 20);
  if (photoURL) profileData.photoURL = photoURL.slice(0, 500);
  profileData.provider = provider;

  if (userSnap.exists) {
    // Atualiza apenas campos de perfil — nunca toca em role ou active
    await userRef.update(profileData);
  } else {
    // Novo usuário — define role e active com valores seguros no servidor
    await userRef.set({
      ...profileData,
      role: 'CUSTOMER',
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Define Custom Claim CUSTOMER no token JWT
    await admin.auth().setCustomUserClaims(userId, {role: 'CUSTOMER'});
  }

  logger.info('Perfil sincronizado', {userId, provider});

  return {success: true, message: 'Perfil sincronizado com sucesso.'};
});
