import { parseCorsOrigins } from '../../src/config/cors';

describe('parseCorsOrigins', () => {
  it('parses a comma-separated list, trimming whitespace and empty entries', () => {
    expect(
      parseCorsOrigins(' https://app.vercel.app , http://localhost:3001,, ', 'production'),
    ).toEqual(['https://app.vercel.app', 'http://localhost:3001']);
  });

  it('normalises a trailing slash and host casing to the browser Origin form', () => {
    expect(parseCorsOrigins('https://App.Vercel.app/', 'production')).toEqual([
      'https://app.vercel.app',
    ]);
  });

  it('removes duplicate origins', () => {
    expect(parseCorsOrigins('https://a.dev,https://a.dev/', 'production')).toEqual([
      'https://a.dev',
    ]);
  });

  it.each([
    ['wildcard', '*'],
    ['missing scheme', 'app.vercel.app'],
    ['path', 'https://app.vercel.app/dashboard'],
    ['query string', 'https://app.vercel.app/?x=1'],
    ['non-http scheme', 'ftp://app.vercel.app'],
  ])('rejects an invalid entry (%s)', (_label, value) => {
    expect(() => parseCorsOrigins(value, 'production')).toThrow(/Invalid CORS origin/);
  });

  it('requires at least one origin in production', () => {
    expect(() => parseCorsOrigins(undefined, 'production')).toThrow(/production/);
    expect(() => parseCorsOrigins(' , ', 'production')).toThrow(/production/);
  });

  it('falls back to local frontend origins outside production', () => {
    expect(parseCorsOrigins(undefined, 'development')).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
  });
});
