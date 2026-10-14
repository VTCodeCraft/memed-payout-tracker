import { loadEnv } from '../../src/config/env';

const ATLAS_URI = 'mongodb+srv://memed_app:s3cr3t-pa55@cluster0.abcde.mongodb.net/memed_dev?retryWrites=true';
const JWT_SECRET = 'k9V2qL7xT4mZ8nR1wY6pB3sD0fH5jC2aE7gU9iO4tX1vQ8';
const REQUIRED = { MONGODB_URI: ATLAS_URI, JWT_SECRET };

/** Returns the configuration error message, or '' if loadEnv succeeded. */
function configError(source: NodeJS.ProcessEnv): string {
  try {
    loadEnv(source);
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}

describe('loadEnv', () => {
  it('returns typed config from valid production variables', () => {
    expect(
      loadEnv({
        ...REQUIRED,
        NODE_ENV: 'production',
        PORT: '10000',
        CORS_ORIGINS: 'https://memed-payout-tracker-livid.vercel.app',
        JWT_EXPIRES_IN: '12h',
      }),
    ).toEqual({
      nodeEnv: 'production',
      port: 10000,
      mongodbUri: ATLAS_URI,
      corsOrigins: ['https://memed-payout-tracker-livid.vercel.app'],
      jwt: { secret: JWT_SECRET, expiresInSeconds: 43_200 },
    });
  });

  it('applies practical development defaults', () => {
    const env = loadEnv({ MONGODB_URI: 'mongodb://127.0.0.1:27017/memed_dev', JWT_SECRET });

    expect(env.nodeEnv).toBe('development');
    expect(env.port).toBe(4000);
    expect(env.corsOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    expect(env.jwt.expiresInSeconds).toBe(7 * 24 * 60 * 60);
  });

  it('accepts a multi-host replica set URI', () => {
    const uri = 'mongodb://h1:27017,h2:27017/memed_test?replicaSet=rs0';
    expect(loadEnv({ ...REQUIRED, MONGODB_URI: uri }).mongodbUri).toBe(uri);
  });

  it('requires MONGODB_URI', () => {
    expect(configError({ JWT_SECRET })).toMatch(/MONGODB_URI: is required/);
  });

  it.each([
    ['no database name', 'mongodb+srv://memed_app:s3cr3t-pa55@cluster0.abcde.mongodb.net/?appName=x'],
    ['no path at all', 'mongodb+srv://memed_app:s3cr3t-pa55@cluster0.abcde.mongodb.net'],
    ['wrong scheme', 'postgres://memed_app:s3cr3t-pa55@db.example.com/memed_dev'],
  ])('rejects a MONGODB_URI with %s without echoing the secret', (_label, uri) => {
    const message = configError({ ...REQUIRED, MONGODB_URI: uri });

    expect(message).toMatch(/MONGODB_URI: must be a mongodb/);
    expect(message).not.toContain('s3cr3t-pa55');
    expect(message).not.toContain('memed_app');
  });

  it.each([
    ['not a number', 'abc'],
    ['out of range', '70000'],
    ['not an integer', '3000.5'],
  ])('rejects PORT that is %s', (_label, port) => {
    expect(configError({ ...REQUIRED, PORT: port })).toMatch(/PORT:/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(configError({ ...REQUIRED, NODE_ENV: 'staging' })).toMatch(/NODE_ENV:/);
  });

  it('reports every invalid variable at once', () => {
    expect(configError({ PORT: 'abc', NODE_ENV: 'staging' })).toMatch(
      /NODE_ENV:[\s\S]*PORT:[\s\S]*MONGODB_URI:[\s\S]*JWT_SECRET:/,
    );
  });

  it('keeps CORS_ORIGINS mandatory in production', () => {
    expect(configError({ ...REQUIRED, NODE_ENV: 'production' })).toMatch(
      /CORS_ORIGINS must list at least one origin in production/,
    );
  });

  describe('JWT settings', () => {
    it('requires JWT_SECRET', () => {
      expect(configError({ MONGODB_URI: ATLAS_URI })).toMatch(/JWT_SECRET: is required/);
    });

    it('rejects a short secret without echoing it', () => {
      const message = configError({ ...REQUIRED, JWT_SECRET: 'tooshort-but-secret' });

      expect(message).toMatch(/JWT_SECRET: must be at least 32 characters/);
      expect(message).not.toContain('tooshort-but-secret');
    });

    it('rejects the .env.example placeholder even though it is long enough', () => {
      expect(configError({ ...REQUIRED, JWT_SECRET: '<replace-with-at-least-32-random-characters>' })).toMatch(
        /JWT_SECRET: is still the .env.example placeholder/,
      );
    });

    it.each([
      ['45s', 45],
      ['30m', 1_800],
      ['12h', 43_200],
      ['7d', 604_800],
    ])('converts JWT_EXPIRES_IN %s to %i seconds', (value, seconds) => {
      expect(loadEnv({ ...REQUIRED, JWT_EXPIRES_IN: value }).jwt.expiresInSeconds).toBe(seconds);
    });

    it.each(['7 days', '0d', '-1h', '1w', '10', '07d'])('rejects JWT_EXPIRES_IN %p', (value) => {
      expect(configError({ ...REQUIRED, JWT_EXPIRES_IN: value })).toMatch(
        /JWT_EXPIRES_IN: must be a positive duration/,
      );
    });
  });

  describe('REDIS_URL', () => {
    it('is optional: unset means no cache', () => {
      expect(loadEnv(REQUIRED).redisUrl).toBeUndefined();
    });

    it.each(['redis://localhost:6379', 'rediss://default:p4ss@cache.example.com:6380'])('accepts %p', (url) => {
      expect(loadEnv({ ...REQUIRED, REDIS_URL: url }).redisUrl).toBe(url);
    });

    it.each(['https://default:p4ss@cache.example.com', 'localhost:6379', 'redis://has space@host', ''])(
      'rejects %p without echoing it',
      (url) => {
        const message = configError({ ...REQUIRED, REDIS_URL: url });

        expect(message).toMatch(/REDIS_URL: must be a redis:\/\/ or rediss:\/\/ URL/);
        if (url) expect(message).not.toContain(url);
        expect(message).not.toContain('p4ss');
      },
    );
  });
});
