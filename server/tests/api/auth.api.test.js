const request = require('supertest');
const app = require('../../src/app');
const db = require('../helpers/db');
const { createUser, bearer } = require('../helpers/factories');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('POST /api/auth/register', () => {
  test('creates a customer account and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Maya Chen', email: 'Maya@Example.com', password: 'leafy-greens' });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: 'Maya Chen', email: 'maya@example.com', role: 'customer' });
    expect(res.body.user).not.toHaveProperty('password');
  });

  test('ignores any attempt to sign up as an admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@example.com', password: 'password123', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('customer');
  });

  test('rejects a duplicate email', async () => {
    await createUser({ email: 'taken@example.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Again', email: 'taken@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/already exists/);
  });

  test('explains every invalid field', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: '', email: 'nope', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(['name', 'email', 'password']);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => createUser({ email: 'sam@example.com', password: 'password123' }));

  test('signs in with the right password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'SAM@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test('gives the same vague message for a wrong password or an unknown email', async () => {
    const wrongPassword = await request(app).post('/api/auth/login').send({ email: 'sam@example.com', password: 'nope' });
    const unknownEmail = await request(app).post('/api/auth/login').send({ email: 'who@example.com', password: 'nope' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });
});

describe('GET /api/auth/me', () => {
  test('requires a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('rejects a forged token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });

  test('returns the signed-in user', async () => {
    const user = await createUser({ name: 'Jordan' });
    const res = await request(app).get('/api/auth/me').set('Authorization', bearer(user));
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Jordan');
  });
});

describe('general API behaviour', () => {
  test('health check responds', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.status).toBe('ok');
  });

  test('unknown API routes return a JSON 404', async () => {
    const res = await request(app).get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/No route/);
  });

  test('malformed JSON gets a friendly 400', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not valid JSON/);
  });
});
