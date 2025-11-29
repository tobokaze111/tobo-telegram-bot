const Product = require('../db/models/Product');
const { logger } = require('../utils/logger');

async function listProducts() {
  return Product.find({}).sort({ createdAt: -1 });
}

async function getProductById(id) {
  return Product.findById(id);
}

async function createProduct(payload) {
  const product = await Product.create(payload);
  logger.info('Product created', { productId: product._id });
  return product;
}

async function addCredentials(productId, credentialsArray) {
  const product = await Product.findById(productId);
  if (!product) throw new Error('PRODUCT_NOT_FOUND');

  product.credentials.push(...credentialsArray);
  product.stock = product.credentials.length;
  await product.save();

  logger.info('Credentials added to product', { productId, count: credentialsArray.length });
  return product;
}

async function updatePrice(productId, price) {
  const product = await Product.findByIdAndUpdate(
    productId,
    { price },
    { new: true }
  );
  if (!product) throw new Error('PRODUCT_NOT_FOUND');

  logger.info('Product price updated', { productId, price });
  return product;
}

async function consumeCredential(productId) {
  const product = await Product.findById(productId);
  if (!product) throw new Error('PRODUCT_NOT_FOUND');
  if (!product.credentials.length) throw new Error('OUT_OF_STOCK');

  const credential = product.credentials.shift();
  product.stock = product.credentials.length;
  await product.save();

  logger.info('Credential consumed', { productId });
  return credential;
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  addCredentials,
  updatePrice,
  consumeCredential,
};


