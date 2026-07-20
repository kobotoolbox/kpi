/**
 * Custom Jest reporter that only shows summary (no passing tests)
 */

class SummaryReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
  }

  onRunComplete(contexts, results) {
    const {
      numTotalTests,
      numPassedTests,
      numFailedTests,
      numTotalTestSuites,
      numPassedTestSuites,
      numFailedTestSuites,
      startTime
    } = results;
    const duration = ((Date.now() - startTime) / 1000).toFixed(3);

    // Print summary
    console.log('');
    console.log(`Test Suites: ${numPassedTestSuites} passed, ${numFailedTestSuites} failed, ${numTotalTestSuites} total`);
    console.log(`Tests:       ${numPassedTests} passed, ${numFailedTests} failed, ${numTotalTests} total`);
    console.log(`Time:        ${duration} s`);
    console.log('Ran all test suites.');
  }
}

module.exports = SummaryReporter;
