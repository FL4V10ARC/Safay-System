const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {FieldValue} = require('firebase-admin/firestore');
const {db} = require('../config/firebase');
const {validateAdmin} = require('../utils/auth');
const logger = require('firebase-functions/logger');

exports.updateVariant = onCall(async (request) => {
  validateAdmin(request);

  const {productId, variantId, sku, color, size, price, active} = request.data;

  if (!productId || !variantId) {
    throw new HttpsError('invalid-argument', 'ID do produto e ID da variante são obrigatórios.');
  }

  // stock foi removido intencionalmente — use adjustStock para movimentações de estoque
  if (request.data.stock !== undefined) {
    throw new HttpsError(
        'invalid-argument',
        'Use a função adjustStock para alterar estoque. Isso garante o registro de auditoria.',
    );
  }

  if (price !== undefined && (typeof price !== 'number' || price <= 0)) {
    throw new HttpsError('invalid-argument', 'Preço deve ser um número positivo.');
  }

  const variantRef = db
      .collection('products')
      .doc(productId)
      .collection('variants')
      .doc(variantId);

  const variantSnap = await variantRef.get();

  if (!variantSnap.exists) {
    throw new HttpsError('not-found', 'Variante não encontrada.');
  }

  const updateData = {updatedAt: FieldValue.serverTimestamp()};

  if (sku !== undefined) updateData.sku = String(sku).trim();
  if (color !== undefined) updateData.color = String(color).trim().slice(0, 50);
  if (size !== undefined) updateData.size = String(size).trim().slice(0, 20);
  if (price !== undefined) updateData.price = price;
  if (active !== undefined) updateData.active = Boolean(active);

  await variantRef.update(updateData);

  logger.info('Variante atualizada', {productId, variantId, adminId: request.auth.uid});

  return {success: true, message: 'Variante atualizada com sucesso.'};
});
