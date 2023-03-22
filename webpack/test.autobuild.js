const testConfig = require('./test.config');

// Auto-builds tests when the tests or js files change.
// Doesn't re-run tests or auto-reload any pages.

// It's useful for visiting file://{/path/to/kpi}/test/tests.html
// to troubleshoot failing tests (refresh to re-run).

// You can use interactive browser console to inspect logged objects.
// example: console.log(expected, actual) in a test file.

module.exports = {
  ...testConfig,
  watch: true,
  stats: {}, // un-hide output from test.config.js
};
