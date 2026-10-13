import { randomUUID } from 'node:crypto';
import { mongo } from 'mongoose';
import { AppError } from '../../lib/app-error';
import { type JwtConfig, signAccessToken } from '../../lib/jwt';
import { hashPassword, verifyPassword } from '../../lib/password';
import { type PublicUser, User, type UserDocument, toPublicUser } from '../../models/user.model';
import type { LoginInput, SignupInput } from './auth.schemas';

export interface AuthResult {
  token: string;
  user: PublicUser;
}

const DUPLICATE_KEY = 11000;

// Checked against when the email is unknown, so every failed login costs one bcrypt
// comparison and response time does not reveal which emails are registered.
const timingEqualizerHash = hashPassword(randomUUID());

export async function signup(input: SignupInput, jwtConfig: JwtConfig): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);

  let user: UserDocument;
  try {
    user = await User.create({ name: input.name, email: input.email, role: input.role, passwordHash });
  } catch (error) {
    // The unique index decides, so two concurrent signups cannot both succeed.
    if (error instanceof mongo.MongoServerError && error.code === DUPLICATE_KEY) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw error;
  }

  return authResult(user, jwtConfig);
}

export async function login(input: LoginInput, jwtConfig: JwtConfig): Promise<AuthResult> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const passwordMatches = await verifyPassword(input.password, user?.passwordHash ?? (await timingEqualizerHash));

  if (!user || !passwordMatches) {
    // One message for both cases so the response never confirms an email exists.
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  return authResult(user, jwtConfig);
}

/** The token's user as currently stored; 401 if the account no longer exists. */
export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token');
  }
  return toPublicUser(user);
}

function authResult(user: UserDocument, jwtConfig: JwtConfig): AuthResult {
  return {
    token: signAccessToken({ id: user.id, role: user.role }, jwtConfig),
    user: toPublicUser(user),
  };
}
