/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__test__'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/__test__/setup/env.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^~config/(.*)$': '<rootDir>/src/config/$1',
    '^~response/(.*)$': '<rootDir>/src/config/helpers/response/$1',
    '^~types/(.*)$': '<rootDir>/src/types/$1',
    '^~utils/(.*)$': '<rootDir>/src/utils/$1',
    '^~services/(.*)$': '<rootDir>/src/services/$1',
    '^~mocks/(.*)$': '<rootDir>/__test__/mocks/$1',
    '^modules/(.*)$': '<rootDir>/src/modules/$1',
    '^middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
  },
  clearMocks: true,
};
