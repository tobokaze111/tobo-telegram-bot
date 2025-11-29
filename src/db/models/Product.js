const mongoose = require('mongoose');

const credentialSchema = new mongoose.Schema(
  {
    email: String,
    password: String,
    validity: String,
    extra: String,
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    type: { type: String, default: 'subscription' },
    credentials: [credentialSchema],
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

module.exports = mongoose.model('Product', productSchema);


