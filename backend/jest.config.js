module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/env.js'],
  globalSetup: '<rootDir>/tests/global-setup.js',
  testTimeout: 30000,
  verbose: true,
};
