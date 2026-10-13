import bcrypt from 'bcryptjs';

// bcrypt cost: 2^10 rounds, roughly 100 ms per hash. Slow enough to make offline
// guessing expensive if the database leaks, fast enough for signup and login.
const BCRYPT_COST = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
