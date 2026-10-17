require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

// Failing loudly here is better than quietly signing tokens with a dev secret in prod.
if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fernleaf',
  jwtSecret: process.env.JWT_SECRET || 'local-dev-secret-do-not-use-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};
