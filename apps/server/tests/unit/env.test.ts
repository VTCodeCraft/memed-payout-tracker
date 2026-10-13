import { loadEnv } from '../../src/config/env';

const ATLAS_URI = 'mongodb+srv://memed_app:s3cr3t-pa55@cluster0.abcde.mongodb.net/memed_dev?retryWrites=true';

describe('loadEnv', () => {
  it('returns typed config from valid production variables', () => {
    expect(
      loadEnv({
        NODE_ENV: 'production',
        PORT: '10000',
        MONGODB_URI: ATLAS_URI,
        CORS_ORIGINS: 'https://memed-payout-tracker-livid.vercel.app',
      }),
    ).toEqual({
      nodeEnv: 'production',
      port: 10000,
      mongodbUri: ATLAS_URI,
      corsOrigins: ['https://memed-payout-tracker-livid.vercel.app'],
    });
  });

  it('applies practical development defaults', () => {
    const env = loadEnv({ MONGODB_URI: 'mongodb://127.0.0.1:27017/memed_dev' });

    expect(env.nodeEnv).toBe('development');
    expect(env.port).toBe(4000);
    expect(env.corsOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  it('accepts a multi-host replica set URI', () => {
    const uri = 'mongodb://h1:27017,h2:27017/memed_test?replicaSet=rs0';
    expect(loadEnv({ MONGODB_URI: uri }).mongodbUri).toBe(uri);
  });

  it('requires MONGODB_URI', () => {
    expect(() => loadEnv({})).toThrow(/MONGODB_URI: is required/);
  });

  it.each([
    ['no database name', 'mongodb+srv://memed_app:s3cr3t-pa55@cluster0.abcde.mongodb.net/?appName=x'],
    ['no path at all', 'mongodb+srv://memed_app:s3cr3t-pa55@cluster0.abcde.mongodb.net'],
    ['wrong scheme', 'postgres://memed_app:s3cr3t-pa55@db.example.com/memed_dev'],
  ])('rejects a MONGODB_URI with %s without echoing the secret', (_label, uri) => {
    let message = '';
    try {
      loadEnv({ MONGODB_URI: uri });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/MONGODB_URI: must be a mongodb/);
    expect(message).not.toContain('s3cr3t-pa55');
    expect(message).not.toContain('memed_app');
  });

  it.each([
    ['not a number', 'abc'],
    ['out of range', '70000'],
    ['not an integer', '3000.5'],
  ])('rejects PORT that is %s', (_label, port) => {
    expect(() => loadEnv({ MONGODB_URI: ATLAS_URI, PORT: port })).toThrow(/PORT:/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadEnv({ MONGODB_URI: ATLAS_URI, NODE_ENV: 'staging' })).toThrow(/NODE_ENV:/);
  });

  it('reports every invalid variable at once', () => {
    expect(() => loadEnv({ PORT: 'abc', NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV:[\s\S]*PORT:[\s\S]*MONGODB_URI:/,
    );
  });

  it('keeps CORS_ORIGINS mandatory in production', () => {
    expect(() => loadEnv({ NODE_ENV: 'production', MONGODB_URI: ATLAS_URI })).toThrow(
      /CORS_ORIGINS must list at least one origin in production/,
    );
  });
});
