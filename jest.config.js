/** @type {import('jest').Config} */
const config = {
  verbose: true,
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/jsapp'],
  moduleNameMapper: {
    '^js/(.*)$': '<rootDir>/jsapp/js/$1',
    '\\.(css|scss)$': 'identity-obj-proxy',
  },
};

module.exports = config;
