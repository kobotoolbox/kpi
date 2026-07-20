/**
 * Custom Jest reporter that only shows failures and summary (no passing tests)
 */

class SummaryReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._failures = [];
  }

  onTestResult(test, testResult, aggregatedResult) {
    // Collect failures
    if (testResult.numFailingTests > 0) {
      this._failures.push({ test, testResult });
    }
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

    // Print failures first
    if (this._failures.length > 0) {
      console.log('\n');
      this._failures.forEach(({ test, testResult }) => {
        console.log(`FAIL! (⦿∩⦿) ${test.path}`);
        testResult.testResults.forEach((result) => {
          if (result.status === 'failed') {
            console.log(`  ● ${result.ancestorTitles.join(' → ')} → ${result.title}\n`);
            if (result.failureMessages && result.failureMessages.length > 0) {
              result.failureMessages.forEach((msg) => {
                console.log(msg);
                console.log('');
              });
            }
          }
        });
      });
    }

    // Print summary
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    console.log(`Test Suites: ${numPassedTestSuites} passed, ${numFailedTestSuites} failed, ${numTotalTestSuites} total`);
    console.log(`Tests:       ${numPassedTests} passed, ${numFailedTests} failed, ${numTotalTests} total`);
    console.log(`Time:        ${duration} s`);
    console.log('✓ Ran all test suites.');
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  }
}

module.exports = SummaryReporter;
