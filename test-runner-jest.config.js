const { getJestConfig } = require('@storybook/test-runner');
const path = require('path');

/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  // Use default test-runner config
  ...getJestConfig(),

  // Use custom summary-only reporter
  reporters: [path.resolve(__dirname, '.storybook/summary-reporter.js')],
};
