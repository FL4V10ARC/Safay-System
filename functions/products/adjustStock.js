const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {FieldValue} = require('firebase-admin/firestore');
const {db} = require('../config/firebase');
const {validateAdmin} = require('../utils/auth');
const logger = require('firebase-functions/logger');

exports.adjustStock = onCall(async (request) => {
  await validateAdmin(request);

  const {
    productId,
    variantId,
    quantity,
    type,
    reason = 'MANUAL_ADJUSTMENT',
  } = request.data;

  if (!productId || !variantId || !type) {
    throw new HttpsError('invalid-argument', 'Produto, variante e tipo são obrigatórios.');
  }

  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
    throw new HttpsError('invalid-argument', 'Quantidade deve ser um número inteiro positivo.');
  }

  if (!['IN', 'OUT', 'ADJUSTMENT'].includes(type)) {
    throw new HttpsError('invalid-argument', 'Tipo de movimentação inválido. Use: IN, OUT, ADJUSTMENT.');
  }

  const variantRef = db
      .collection('products')
      .doc(productId)
      .collection('variants')
      .doc(variantId);

  let previousStock;
  let newStock;

  try {
    await db.runTransaction(async (transaction) => {
      // Leitura DENTRO da transaction — evita race condition com outros ajustes
      const variantDoc = await transaction.get(variantRef);

      if (!variantDoc.exists) {
        throw new HttpsError('not-found', 'Variante não encontrada.');
      }

      previousStock = variantDoc.data().stock ?? 0;

      if (type === 'IN') {
        newStock = previousStock + quantity;
      } else if (type === 'OUT') {
        if (previousStock < quantity) {
          throw new HttpsError(
              'failed-precondition',
              `Estoque insuficiente para saída. Disponível: ${previousStock}.`,
          );
        }
        newStock = previousStock - quantity;
      } else if (type === 'ADJUSTMENT') {
        newStock = quantity; // quantity é o valor absoluto no ADJUSTMENT
      }

      transaction.update(variantRef, {
        stock: newStock,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const movementRef = db.collection('stock_movements').doc();
      transaction.set(movementRef, {
        productId,
        variantId,
        type,
        reason,
        quantity,
        previousStock,
        newStock,
        adjustedBy: request.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('Erro ao ajustar estoque', {error: err.message, productId, variantId});
    throw new HttpsError('internal', 'Erro ao ajustar estoque. Tente novamente.');
  }

  logger.info('Estoque ajustado', {
    productId,
    variantId,
    type,
    previousStock,
    newStock,
    adminId: request.auth.uid,
  });

  return {
    success: true,
    message: 'Estoque ajustado com sucesso.',
    previousStock,
    newStock,
  };
});
