/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.ts'],
  testMatch: ['**/tests/**/*.test.ts'],
  clearMocks: true,
};
