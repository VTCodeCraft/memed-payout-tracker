import { signAccessToken } from '../../src/lib/jwt';
import { type Role, User } from '../../src/models/user.model';
import { TEST_JWT } from './app';

/** Creates a real user and returns its id plus a matching Bearer header. */
export async function account(role: Role, email: string) {
  const user = await User.create({ name: `${role} account`, email, role, passwordHash: 'not-used-in-these-tests' });
  return { id: user.id, auth: `Bearer ${signAccessToken({ id: user.id, role }, TEST_JWT)}` };
}
