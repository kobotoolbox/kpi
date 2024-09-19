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
  transform: {
    '\\.[jt]sx?$': ['babel-jest', {configFile: `${__dirname}/../../.babelrc.json`}],
  },
};

export default config;
