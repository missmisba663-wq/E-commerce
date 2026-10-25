import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Each test file runs in its own process with a fresh, smaller database.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shopverse-test-'));
process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(dir, 'test.db');
process.env.SEED_LIMIT = '4000';
process.env.STRIPE_SECRET_KEY = '';
process.env.ADMIN_EMAIL = 'admin@test.dev';
process.env.ADMIN_PASSWORD = 'Admin12345';

const { default: request } = await import('supertest');
const { createApp } = await import('../src/app.js');
const { ensureSeeded } = await import('../src/db/seed.js');
export const { db, sql } = await import('../src/db/index.js');

ensureSeeded({ log: () => {} });
export const app = createApp();

let counter = 0;

/** Registers a fresh customer and returns a supertest agent that keeps its session cookie. */
export async function customer() {
  const agent = request.agent(app);
  const email = `shopper${++counter}-${Date.now()}@test.dev`;
  const res = await agent.post('/api/auth/register').send({ name: 'Test Shopper', email, password: 'Password1' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return Object.assign(agent, { user: res.body.user });
}

export async function admin() {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: 'admin@test.dev', password: 'Admin12345' }).expect(200);
  return agent;
}

export const anon = () => request(app);

export const inStockProduct = (minStock = 5) =>
  sql('SELECT id, stock, price_cents FROM products WHERE stock >= ? AND is_active = 1 ORDER BY id LIMIT 1 OFFSET ?')
    .get(minStock, counter++);

export const address = {
  fullName: 'Asha Verma',
  phone: '+91 98765 43210',
  line1: '221 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
  country: 'India',
};
