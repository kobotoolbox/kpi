import type { Config } from 'jest'
import { defaults } from 'jest-config'

// Config to run ☕ unit tests using the Jest runner
//
// To run the unit tests: 🏃
//
//     npx jest --config ./jsapp/jest/unit.config.ts
//

const config: Config = {
  // Naming convention (*.tests.*)
  testMatch: ['**/?(*.)+(tests).(js|jsx|ts|tsx|coffee)'],

  // Where to find tests. <rootDir> = 'kpi/jsapp/jest'
  roots: [
    '<rootDir>/../js/', // unit tests    🛠️ 'jsapp/js/**/*.tests.ts'
    '<rootDir>/../../test/', // xlform/coffee ☕ 'test/**/*.tests.coffee'
  ],

  // Where to resolve module imports
  moduleNameMapper: {
    // ℹ️ same aliases as in webpack.common.js (module.resolve.alias)
    '^#/(.*)$': '<rootDir>/../js/$1', // 📁 'js/*'
    // 🎨 mock all CSS modules imported (styles.root = 'root')
    '\\.(css|scss)$': 'identity-obj-proxy',
  },

  // Extensions to try in order (for import statements with no extension)
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'coffee'],

  // Transformers (SWC for JS/TS, CoffeeScript for .coffee)
  transform: {
    '^.+\\.(mjs|js|jsx|ts|tsx)$': '@swc/jest',
    '^.+\\.coffee$': '<rootDir>/coffeeTransformer.js',
  },

  // Exclude these files, even if they contain tests
  testPathIgnorePatterns: [
    'test/xlform/integration.tests.coffee$', // 📄 skipped in `ee98aebe631b`
    ...defaults.testPathIgnorePatterns, // 📦 exclude '/node_modules/'
  ],

  // By default Jest skips transforming node_modules.
  // These packages are explicitly allowlisted because they can publish ESM output,
  // which otherwise causes parse errors like "unexpected token export/import" in tests.
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@mswjs|@open-draft|@bundled-es-modules|headers-polyfill|outvariant|is-node-process|strict-event-emitter|statuses|until-async|rettime)/)',
  ],

  // Set up test environment
  testEnvironment: 'jsdom',

  // Make Chai and jQuery globals available in the test environment
  setupFilesAfterEnv: ['<rootDir>/setupUnitTest.ts'],

  // Appearance options (for console output)
  verbose: true,
  displayName: { name: 'UNIT', color: 'black' },
}

export default config
