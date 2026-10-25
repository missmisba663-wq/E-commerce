import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { anon, app, customer } from './helpers.js';

test('register signs the user in and hides the password hash', async () => {
  const agent = await customer();
  assert.equal(agent.user.role, 'customer');
  assert.equal(agent.user.password_hash, undefined);
  const me = await agent.get('/api/auth/me').expect(200);
  assert.equal(me.body.user.email, agent.user.email);
});

test('register rejects duplicates and weak passwords', async () => {
  const agent = await customer();
  const dup = await anon().post('/api/auth/register').send({ name: 'Again', email: agent.user.email.toUpperCase(), password: 'Password1' });
  assert.equal(dup.status, 409);
  const weak = await anon().post('/api/auth/register').send({ name: 'Weak', email: 'weak@test.dev', password: 'short' });
  assert.equal(weak.status, 400);
  assert.match(weak.body.error, /at least 8/);
});

test('login checks the password; logout clears the session', async () => {
  const agent = await customer();
  const bad = await anon().post('/api/auth/login').send({ email: agent.user.email, password: 'WrongPass1' });
  assert.equal(bad.status, 401);

  const fresh = request.agent(app);
  await fresh.post('/api/auth/login').send({ email: agent.user.email, password: 'Password1' }).expect(200);
  assert.ok((await fresh.get('/api/auth/me')).body.user);
  await fresh.post('/api/auth/logout').expect(204);
  assert.equal((await fresh.get('/api/auth/me')).body.user, null);
});

test('password change requires the current password', async () => {
  const agent = await customer();
  await agent.post('/api/auth/me/password').send({ currentPassword: 'nope', newPassword: 'NewPassword2' }).expect(400);
  await agent.post('/api/auth/me/password').send({ currentPassword: 'Password1', newPassword: 'NewPassword2' }).expect(204);
  await anon().post('/api/auth/login').send({ email: agent.user.email, password: 'NewPassword2' }).expect(200);
});

test('protected routes require a session', async () => {
  await anon().get('/api/orders').expect(401);
  await anon().get('/api/account/wishlist').expect(401);
  const shopper = await customer();
  await shopper.get('/api/admin/stats').expect(403);
});
