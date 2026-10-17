const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');

connectDB(env.mongoUri)
  .then(() => {
    app.listen(env.port, () => {
      console.log(`Fernleaf API listening on http://localhost:${env.port} (${env.nodeEnv})`);
    });
  })
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
