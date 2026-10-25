import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { sql } from '../db/index.js';
import { HttpError, validate } from '../lib/http.js';
import { clearSession, issueSession, publicUser, requireAuth } from '../middleware/auth.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  email: z.email('Please enter a valid email').trim().toLowerCase(),
  password,
});

const loginSchema = z.object({
  email: z.email('Please enter a valid email').trim().toLowerCase(),
  password: z.string().min(1, 'Please enter your password'),
});

router.post('/register', authLimiter, validate(registerSchema), (req, res) => {
  const { name, email, password: pw } = req.valid.body;
  if (sql('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw new HttpError(409, 'An account with this email already exists');
  }
  const { lastInsertRowid } = sql('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name, email, bcrypt.hashSync(pw, 10));
  const user = sql('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
  issueSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', authLimiter, validate(loginSchema), (req, res) => {
  const { email, password: pw } = req.valid.body;
  const user = sql('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(pw, user.password_hash)) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  issueSession(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

router.patch('/me', requireAuth, validate(z.object({ name: z.string().trim().min(2).max(80) })), (req, res) => {
  sql('UPDATE users SET name = ? WHERE id = ?').run(req.valid.body.name, req.user.id);
  res.json({ user: publicUser({ ...req.user, name: req.valid.body.name }) });
});

router.post(
  '/me/password',
  requireAuth,
  authLimiter,
  validate(z.object({ currentPassword: z.string().min(1), newPassword: password })),
  (req, res) => {
    const { currentPassword, newPassword } = req.valid.body;
    const { password_hash } = sql('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(currentPassword, password_hash)) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    sql('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.user.id);
    res.status(204).end();
  },
);

export default router;
