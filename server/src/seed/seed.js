/* Fills your database with a believable shop: two users and a catalogue.
 * Run with `npm run seed`. It wipes the existing data, so it refuses to run in production. */
const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB } = require('../config/db');
const { seedDatabase, printDemoLogins } = require('./seedDatabase');

async function run() {
  if (env.nodeEnv === 'production') {
    throw new Error('Refusing to wipe a production database. Unset NODE_ENV=production to seed.');
  }
  await connectDB(env.mongoUri);
  const counts = await seedDatabase();
  console.log(`Seeded ${counts.products} products and ${counts.users} users.`);
  printDemoLogins();
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
