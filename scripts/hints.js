/* eslint-disable no-console */

// Select a helpful hint to be logged to the console.
// Mainly for multi-line hints, to run before package.json scripts.

// terminal styles
const s = {
  normal: '\u001b[0m', // reset styles

  red: '\u001b[91m', // bright red
  magenta: '\u001b[95m', // bright magenta
  blue: '\u001b[94m', // bright blue
  darkblue: '\u001b[34m', // dark blue

  underline: '\u001b[4m', // underline
  nounderline: '\u001b[24m', // end underline
};

// Example: npm run hint watch
//                       ^ argv[2]
const hintName = process.argv[2];
const hints = {
  // Hints for npm scripts
  watch: `
    Use \`npm run generate-icons\` if you've made changes to
      jsapp/svg-icons, or switched to a branch that did.

           ${s.darkblue}Enjoy a quicker-launching dev server!
  `,

  'test-autobuild': `
    This will rebuild the js tests on change.

    Open ${s.underline}file://${process.cwd()}/test/tests.html${s.nounderline}
    to see the test results in your browser.

    Reload the page to re-run the tests.
  `,

  SKIP_TS_CHECK: `${s.red}
     Skipping TypeScript check (${s.magenta}SKIP_TS_CHECK${s.red})
  ${s.normal}`,
};
const hint = hints[hintName];
if (hint) {
  console.warn(`${s.blue}${hint}${s.normal}`);
}

// Provide an auxiliary hint.
const tsCheckAffects = ['build', 'watch', 'test', 'test-autobuild'];
if (process.env.SKIP_TS_CHECK && tsCheckAffects.includes(hintName)) {
  //            bright red                           default
  console.warn('\u001b[91m' + hints.SKIP_TS_CHECK + '\u001b[0m');
}
