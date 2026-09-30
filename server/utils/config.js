import { randomBytes } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const serverDirectory = dirname(fileURLToPath(import.meta.url)).replace(/[\\/]utils$/, '');
const envPath = join(serverDirectory, '.env');

export async function loadConfig() {
  dotenv.config({ path: envPath });
  process.env.PORT ||= '4000';
  process.env.HOST ||= '0.0.0.0';
  process.env.ALLOWED_EMAIL_DOMAINS ||= 'newhorizonindia.edu';
  process.env.WORKBOOK_PATH ||= '../Book2.xlsx';

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    const secret = randomBytes(32).toString('hex');
    await appendFile(envPath, `${process.env.JWT_SECRET ? '\n' : ''}JWT_SECRET=${secret}\n`, 'utf8');
    process.env.JWT_SECRET = secret;
  }
  const domains = process.env.ALLOWED_EMAIL_DOMAINS.split(',').map((domain) => domain.trim()).filter(Boolean);
  if (domains.length === 0) throw new Error('Configure ALLOWED_EMAIL_DOMAINS in server/.env.');

  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }
}