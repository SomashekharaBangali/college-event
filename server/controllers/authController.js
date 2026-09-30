import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail } from '../utils/workbookStore.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function makeSession(user) {
  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role || 'student' };
  const token = jwt.sign(safeUser, process.env.JWT_SECRET, { expiresIn: '7d', issuer: 'campus-connect' });
  return { token, user: safeUser };
}

export async function signup(request, response, next) {
  try {
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
    const email = normalizeEmail(request.body?.email);
    const password = request.body?.password;
    const passwordBytes = typeof password === 'string' ? Buffer.byteLength(password, 'utf8') : 0;
    const allowedDomains = new Set((process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map((domain) => domain.trim().toLowerCase().replace(/^@/, '')).filter(Boolean));

    if (name.length < 2 || name.length > 80) {
      return response.status(400).json({ message: 'Name must be between 2 and 80 characters.' });
    }
    if (!email) return response.status(400).json({ message: 'Enter a valid college email address.' });
    if (!allowedDomains.has(email.split('@')[1])) {
      return response.status(400).json({ message: 'Use your college’s official email domain.' });
    }
    if (passwordBytes < 10 || passwordBytes > 128) {
      return response.status(400).json({ message: 'Password must be between 10 and 128 bytes.' });
    }

    const user = await createUser({ name, email, passwordHash: await hashPassword(password) });
    if (!user) return response.status(409).json({ message: 'An account already exists for this email.' });
    return response.status(201).json({ ...makeSession(user), message: 'Account created.' });
  } catch (error) {
    return next(error);
  }
}

export async function login(request, response, next) {
  try {
    const email = normalizeEmail(request.body?.email);
    const password = request.body?.password;
    if (!email || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 128) {
      return response.status(400).json({ message: 'Enter a valid email and password.' });
    }

    const user = await findUserByEmail(email);
    if (!user || !await verifyPassword(password, user.passwordHash)) {
      return response.status(401).json({ message: 'Email or password is incorrect.' });
    }
    return response.json(makeSession(user));
  } catch (error) {
    return next(error);
  }
}

export function currentUser(request, response) {
  response.json({ user: request.user });
}