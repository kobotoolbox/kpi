/* eslint-disable no-console */

// Select a helpful hint to be logged to the console.
// Mainly for multi-line hints, to run before package.json scripts.

// Example: npm run hint watch
//                       ^ argv[2]
const hintName = process.argv[2];
const hints = {
  // Hints for npm scripts
  watch: `
    Use \`npm run generate-icons\` if you've made changes to
      jsapp/svg-icons, or switched to a branch that did.

           \u001b[34mEnjoy a quicker-launching dev server!
  `,

  'test-autobuild': `
    This will rebuild the js tests on change.

    Open \u001b[4mfile://${process.cwd()}/test/tests.html\u001b[24m
    to see the test results in your browser.

    Reload the page to re-run the tests.
  `,

  SKIP_TS_CHECK: `
     Skipping TypeScript check (\u001b[95mSKIP_TS_CHECK\u001b[31m)
  `,
};
const hint = hints[hintName];
if (hint) {
  //            bright blue             default
  console.warn('\u001b[94m' + hint + '\u001b[0m');
}

// Provide an auxiliary hint.
if (process.env.SKIP_TS_CHECK) {
  //            bright red                           default
  console.warn('\u001b[91m' + hints.SKIP_TS_CHECK + '\u001b[0m');
}
