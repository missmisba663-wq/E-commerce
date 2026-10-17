/* `npm run demo`: runs the API against a throwaway in-memory MongoDB, already seeded.
 * No database install needed, and everything resets when you stop it. Handy for trying the shop out. */
const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri('fernleaf');

  // Required only after MONGO_URI is set, because config/env reads it when it loads.
  const env = require('../config/env');
  const { connectDB } = require('../config/db');
  const { seedDatabase, printDemoLogins } = require('../seed/seedDatabase');
  const app = require('../app');

  await connectDB(env.mongoUri);
  await seedDatabase();

  app.listen(env.port, () => {
    console.log(`\nFernleaf demo API on http://localhost:${env.port} (in-memory database, resets on exit)`);
    printDemoLogins();
  });

  const shutdown = async () => {
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
