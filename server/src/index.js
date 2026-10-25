import { createApp } from './app.js';
import { config } from './config.js';
import { ensureSeeded } from './db/seed.js';
import { expireStaleOrders } from './lib/orders.js';

ensureSeeded();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`ShopVerse API listening on http://localhost:${config.port} (${config.env})`);
});

const sweeper = setInterval(() => expireStaleOrders().catch(console.error), 5 * 60_000);

function shutdown() {
  clearInterval(sweeper);
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
