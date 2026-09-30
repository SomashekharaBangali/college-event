import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveBits = promisify(pbkdf2);
const passwordIterations = 600_000;
const outputLength = 32;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await deriveBits(password, salt, passwordIterations, outputLength, 'sha256');
  return `pbkdf2$${passwordIterations}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false;
  const [algorithm, iterationText, saltHex, hashHex] = storedHash.split('$');
  const iterations = Number(iterationText);
  if (algorithm !== 'pbkdf2' || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
  if (!/^(?:[a-f\d]{2}){16}$/i.test(saltHex ?? '') || !/^(?:[a-f\d]{2}){32}$/i.test(hashHex ?? '')) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await deriveBits(password, salt, iterations, expected.length, 'sha256');
  return timingSafeEqual(actual, expected);
}