import jwt from 'jsonwebtoken';
import { signAccessToken } from '../../src/lib/jwt';

const config = { secret: 'k9V2qL7xT4mZ8nR1wY6pB3sD0fH5jC2aE7gU9iO4tX1vQ8', expiresInSeconds: 3_600 };

describe('signAccessToken', () => {
  it('signs an HS256 token carrying only the user id and role', () => {
    const token = signAccessToken({ id: '66f1c0ffee', role: 'creator' }, config);

    const decoded = jwt.verify(token, config.secret, { algorithms: ['HS256'], complete: true });

    expect(decoded.header.alg).toBe('HS256');
    expect(decoded.payload).toEqual({
      sub: '66f1c0ffee',
      role: 'creator',
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
  });

  it('expires after the configured number of seconds', () => {
    const issuedAt = Date.UTC(2026, 9, 13) / 1000;
    jest.useFakeTimers({ now: issuedAt * 1000 });

    const token = signAccessToken({ id: 'u1', role: 'brand' }, config);
    jest.useRealTimers();

    expect(jwt.decode(token)).toMatchObject({ iat: issuedAt, exp: issuedAt + 3_600 });
  });

  it('cannot be verified with a different secret', () => {
    const token = signAccessToken({ id: 'u1', role: 'brand' }, config);

    expect(() => jwt.verify(token, 'a-completely-different-secret-value-1234')).toThrow(jwt.JsonWebTokenError);
  });
});
