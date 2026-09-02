import 'server-only';

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

import { getPublishedSitesDatabase } from '@/lib/published-sites';

const sessionDurationMs = 30 * 24 * 60 * 60 * 1_000;
const signInWindowMs = 15 * 60 * 1_000;
const maxSignInAttempts = 8;
const productionCookieName = '__Host-sleeksite_session';
const developmentCookieName = 'sleeksite_session';
const scryptOptions = {
  N: 2 ** 15,
  r: 8,
  p: 3,
  maxmem: 64 * 1024 * 1024,
} as const;

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
};

export class AccountError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function getSessionCookieName() {
  return process.env.NODE_ENV === 'production'
    ? productionCookieName
    : developmentCookieName;
}

export function getSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires,
    priority: 'high' as const,
  };
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateAccountInput(input: {
  name?: string;
  email: string;
  password: string;
  requireName: boolean;
}) {
  const name = input.name?.trim().replace(/\s+/g, ' ') ?? '';
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (input.requireName && (name.length < 2 || name.length > 60)) {
    throw new AccountError('Enter your name using 2 to 60 characters.', 400);
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AccountError('Enter a valid email address.', 400);
  }
  if (
    password.length < 10 ||
    password.length > 128 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new AccountError(
      'Use 10–128 characters with at least one letter and one number.',
      400,
    );
  }

  return { name, email, password };
}

function derivePassword(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      64,
      scryptOptions,
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await derivePassword(password, salt);
  return [
    'scrypt',
    scryptOptions.N,
    scryptOptions.r,
    scryptOptions.p,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, n, r, p, saltValue, keyValue] = storedHash.split('$');
  if (
    algorithm !== 'scrypt' ||
    Number(n) !== scryptOptions.N ||
    Number(r) !== scryptOptions.r ||
    Number(p) !== scryptOptions.p ||
    !saltValue ||
    !keyValue
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(keyValue, 'base64url');
    const actual = await derivePassword(
      password,
      Buffer.from(saltValue, 'base64url'),
    );
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function getCookieValue(request: Request, name: string) {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [candidate, ...value] = part.trim().split('=');
    if (candidate === name) return value.join('=');
  }
  return '';
}

async function createSession(userId: string) {
  const database = await getPublishedSitesDatabase();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(token);
  const now = Date.now();
  const expires = new Date(now + sessionDurationMs);

  await database`
    DELETE FROM user_sessions
    WHERE expires_at <= ${now}
  `;
  await database`
    INSERT INTO user_sessions (token_hash, user_id, expires_at, created_at)
    VALUES (${tokenHash}, ${userId}, ${expires.getTime()}, ${now})
  `;

  return { token, expires };
}

async function recordSignInAttempt(email: string) {
  const database = await getPublishedSitesDatabase();
  const now = Date.now();
  const cutoff = now - signInWindowMs;
  const keyHash = createHash('sha256').update(email).digest('hex');

  await database`
    DELETE FROM auth_attempts WHERE attempted_at < ${cutoff}
  `;
  const attempts = await database`
    SELECT COUNT(*)::int AS count
    FROM auth_attempts
    WHERE key_hash = ${keyHash} AND attempted_at >= ${cutoff}
  `;
  const count = Number((attempts[0] as { count?: number } | undefined)?.count);
  if (count >= maxSignInAttempts) {
    throw new AccountError(
      'Too many sign-in attempts. Wait 15 minutes and try again.',
      429,
    );
  }

  await database`
    INSERT INTO auth_attempts (id, key_hash, attempted_at)
    VALUES (${crypto.randomUUID()}, ${keyHash}, ${now})
  `;
  return { database, keyHash };
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}) {
  const { name, email, password } = validateAccountInput({
    ...input,
    requireName: true,
  });
  const database = await getPublishedSitesDatabase();
  const existing = await database`
    SELECT id FROM accounts WHERE email = ${email} LIMIT 1
  `;
  if (existing.length) {
    throw new AccountError(
      'An account already exists for this email. Sign in instead.',
      409,
    );
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  try {
    await database`
      INSERT INTO accounts (id, name, email, password_hash, created_at)
      VALUES (${id}, ${name}, ${email}, ${passwordHash}, ${Date.now()})
    `;
  } catch {
    throw new AccountError(
      'An account already exists for this email. Sign in instead.',
      409,
    );
  }

  const session = await createSession(id);
  return { user: { id, name, email }, ...session };
}

export async function signIn(input: { email: string; password: string }) {
  const { email, password } = validateAccountInput({
    ...input,
    requireName: false,
  });
  const { database, keyHash } = await recordSignInAttempt(email);
  const rows = await database`
    SELECT id, name, email, password_hash
    FROM accounts
    WHERE email = ${email}
    LIMIT 1
  `;
  const account = rows[0] as
    | { id: string; name: string; email: string; password_hash: string }
    | undefined;

  const passwordMatches = account
    ? await verifyPassword(password, account.password_hash)
    : await derivePassword(password, Buffer.alloc(16)).then(() => false);
  if (!account || !passwordMatches) {
    throw new AccountError('Email or password is incorrect.', 401);
  }

  await database`
    DELETE FROM auth_attempts WHERE key_hash = ${keyHash}
  `;
  const session = await createSession(account.id);
  return {
    user: { id: account.id, name: account.name, email: account.email },
    ...session,
  };
}

export async function getAuthenticatedUser(request: Request) {
  const token =
    getCookieValue(request, productionCookieName) ||
    getCookieValue(request, developmentCookieName);
  if (!token || token.length > 100) return null;

  const database = await getPublishedSitesDatabase();
  const rows = await database`
    SELECT accounts.id, accounts.name, accounts.email
    FROM user_sessions
    INNER JOIN accounts ON accounts.id = user_sessions.user_id
    WHERE user_sessions.token_hash = ${hashSessionToken(token)}
      AND user_sessions.expires_at > ${Date.now()}
    LIMIT 1
  `;
  const user = rows[0] as AuthenticatedUser | undefined;
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

export async function deleteSession(request: Request) {
  const token =
    getCookieValue(request, productionCookieName) ||
    getCookieValue(request, developmentCookieName);
  if (!token || token.length > 100) return;

  const database = await getPublishedSitesDatabase();
  await database`
    DELETE FROM user_sessions WHERE token_hash = ${hashSessionToken(token)}
  `;
}
