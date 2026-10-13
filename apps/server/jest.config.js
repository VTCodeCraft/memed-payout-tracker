// The "test" script runs Jest under `node --experimental-vm-modules`: MongoDB driver
// 7.6+ loads `os` with a dynamic import() during its handshake, which Jest only
// supports with VM modules enabled (upstream bug NODE-7832). Without the flag every
// connection fails with "Missing required sub-document 'driver'". Drop the flag
// once a driver release includes the NODE-7832 fix.

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
};
