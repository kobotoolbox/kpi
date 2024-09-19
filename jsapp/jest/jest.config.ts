import type {Config} from 'jest';

const config: Config = {
  verbose: true,
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/../js', '<rootDir>'],
  moduleNameMapper: {
    '^js/(.*)$': '<rootDir>/../js/$1',
    '\\.(css|scss)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/setupJestTest.ts'],
  transform: {'^.+\\.(t|j)sx?$': '@swc/jest'},
};

export default config;
