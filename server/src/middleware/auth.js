import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { sql } from '../db/index.js';
import { HttpError } from '../lib/http.js';

export const COOKIE_NAME = 'sv_token';

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: config.isProd });
}

/** Attaches req.user when a valid session cookie is present; never rejects. */
export function loadUser(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const { sub } = jwt.verify(token, config.jwtSecret);
      const user = sql('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(sub);
      if (user) req.user = user;
    } catch {
      // expired or tampered token: treat as signed out
    }
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue'));
  next();
}

export function requireAdmin(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue'));
  if (req.user.role !== 'admin') return next(new HttpError(403, 'Admin access required'));
  next();
}

export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.created_at });
