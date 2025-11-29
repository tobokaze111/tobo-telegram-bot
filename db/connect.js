const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  try {
    await mongoose.connect(uri, {
      autoIndex: true
    });
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error', { error });
    throw error;
  }
}

module.exports = {
  connectDB,
};


