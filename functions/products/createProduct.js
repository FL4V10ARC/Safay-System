const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {FieldValue} = require('firebase-admin/firestore');
const {db} = require('../config/firebase');
const {validateAdmin} = require('../utils/auth');
const logger = require('firebase-functions/logger');

exports.createProduct = onCall(async (request) => {
  validateAdmin(request);

  const {
    name,
    description = '',
    categoryName,
    basePrice,
    featured = false,
    active = true,
    coverImage = '',
    gallery = [],
    variants,
  } = request.data;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'Nome do produto é obrigatório.');
  }

  if (!categoryName || typeof categoryName !== 'string') {
    throw new HttpsError('invalid-argument', 'Categoria é obrigatória.');
  }

  if (typeof basePrice !== 'number' || basePrice <= 0) {
    throw new HttpsError('invalid-argument', 'Preço base deve ser um número positivo.');
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    throw new HttpsError('invalid-argument', 'O produto precisa ter pelo menos uma variante.');
  }

  // Valida TODAS as variantes ANTES de criar qualquer documento
  for (const variant of variants) {
    if (!variant.sku || !variant.color || !variant.size || !variant.price) {
      throw new HttpsError('invalid-argument', 'SKU, cor, tamanho e preço são obrigatórios em cada variante.');
    }
    if (typeof variant.price !== 'number' || variant.price <= 0) {
      throw new HttpsError('invalid-argument', `Preço inválido na variante SKU "${variant.sku}".`);
    }
    if (variant.stock !== undefined && (typeof variant.stock !== 'number' || variant.stock < 0)) {
      throw new HttpsError('invalid-argument', `Estoque inválido na variante SKU "${variant.sku}".`);
    }
  }

  const productRef = db.collection('products').doc();

  // Cria produto E variantes em um único batch atômico — ou tudo, ou nada
  const batch = db.batch();

  batch.set(productRef, {
    name: name.trim().slice(0, 200),
    description: description.slice(0, 2000),
    categoryName,
    basePrice,
    featured: Boolean(featured),
    active: Boolean(active),
    coverImage,
    gallery: Array.isArray(gallery) ? gallery.slice(0, 10) : [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  for (const variant of variants) {
    const variantRef = productRef.collection('variants').doc();
    batch.set(variantRef, {
      sku: String(variant.sku).trim(),
      color: String(variant.color).trim().slice(0, 50),
      size: String(variant.size).trim().slice(0, 20),
      price: variant.price,
      stock: variant.stock || 0,
      active: variant.active !== false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  logger.info('Produto criado', {
    productId: productRef.id,
    name: name.trim(),
    variantCount: variants.length,
    adminId: request.auth.uid,
  });

  return {
    success: true,
    message: 'Produto criado com sucesso.',
    productId: productRef.id,
  };
});
