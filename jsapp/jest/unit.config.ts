import type {Config} from 'jest';
import {defaults} from 'jest-config';

// Config to run ☕ unit tests using the Jest runner
//
// To run the unit tests: 🏃
//
//     npx jest --config ./jsapp/jest/unit.config.ts
//

const config: Config = {
  // Naming convention (*.tests.*)
  testMatch: ['**/?(*.)+(tests).(js|jsx|ts|tsx|es6|coffee)'],

  // Where to find tests. <rootDir> = 'kpi/jsapp/jest'
  roots: [
    '<rootDir>/../js/',      // unit tests    🛠️ 'jsapp/js/**/*.tests.{ts,es6}'
    '<rootDir>/../../test/', // xlform/coffee ☕ 'test/**/*.tests.coffee'
  ],

  // Where to resolve module imports
  moduleNameMapper: {
    // ℹ️ same aliases as in webpack.common.js (module.resolve.alias)
    '^jsapp/(.+)$': '<rootDir>/../$1',         // 📁 'jsapp/*'
    '^js/(.*)$':    '<rootDir>/../js/$1',      // 📁 'js/*'
    '^test/(.*)$':  '<rootDir>/../../test/$1', // 📁 'test/*'
    '^utils$':      '<rootDir>/../js/utils',   // 📄 'utils'
    // 🎨 mock all CSS modules imported (styles.root = 'root')
    '\\.(css|scss)$': 'identity-obj-proxy',
  },

  // Extensions to try in order (for import statements with no extension)
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'es6', 'coffee'],

  // Transformers (SWC for JS/TS, CoffeeScript for .coffee)
  transform: {
    '^.+\\.(js|jsx|ts|tsx|es6)$': '@swc/jest',
    '^.+\\.coffee$': '<rootDir>/coffeeTransformer.js',
  },

  // Exclude these files, even if they contain tests
  testPathIgnorePatterns: [
    'test/xlform/integration.tests.coffee$', // 📄 skipped in `ee98aebe631b`
    ...defaults.testPathIgnorePatterns,      // 📦 exclude '/node_modules/'
  ],

  // Set up test environment
  testEnvironment: 'jsdom',

  // Make Chai and jQuery globals available in the test environment
  setupFilesAfterEnv: ['<rootDir>/setupUnitTest.ts'],

  // Appearance options (for console output)
  verbose: true,
  displayName: {name: 'UNIT', color: 'black'},
};

export default config;
