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

/*
  NPM VERSION WARNING

  Issue a warning if there's a version mismatch between expected and user's
  version of Node or npm, since it could cause strange difficulties.

  It is a bit redundant with the EBADENGINE warning issued from package.json,
  but this script (originally written for a bumpy >=16.15.1 upgrade) provides
  a bit of context.

  Show on preinstall. Since it's easy to miss there, also show it on other
  run scripts such as 'watch'.
*/
const ok_node = 'v20.17.0';
const ok_npm = '10.8.2';

if (process.version !== ok_node) {
  const blu = '\u001b[94m'; // bright blue
  const yel = '\u001b[93m'; // bright yellow
  const red = '\u001b[91m'; // bright red
  const nrm = '\u001b[0m'; // reset to "normal"

  console.warn(`${blu}
  --------------------------------------------------------------`);

  console.warn(`${nrm}
    Are you running a supported version of Node and npm?
    ${nrm}
      node ${yel}${ok_node}${nrm},  ${yel}npm@${ok_npm}${nrm}  supported`);

  // Let's be more helpful by running `npm --version` instead of making
  // you do it.
  let detectedNpm = '?';
  try {
    detectedNpm = require('child_process')
      .execSync('npm --version')
      .toString()
      .trim();
  } catch (error) {
    console.warn(error.message);
    console.warn(error.stderr.toString());
    process.exit();
  }
  const wrongNpm = detectedNpm !== ok_npm;
  const wrongNode = process.version !== ok_node;
  console.warn(
    `      node ${wrongNode ? yel : ''}${process.version}${nrm},  ${
      wrongNpm ? red : ''
    }npm@${detectedNpm}${nrm}  detected`
  );

  // Things might actually work OK on a mismatched Node version,
  // but running the wrong npm version when installing packages is
  // what causes the most problems.
  if (wrongNpm) {
    console.warn(`
    ${blu}(This is probably OK, but it's helpful to
     run the same version we're using in release.)${nrm}

    To switch to a supported Node / npm version:

      Use Node ${ok_node}, which comes with npm@${ok_npm}
         \`nvm use\` or \`fnm use\`

      or \`npm install -g npm@${ok_npm}\`
          to change npm for your current Node`);

    console.warn(`${yel}
    If you've run \`npm install\` with a different npm version,${nrm}
    there could be changes in node_modules and package-lock.json

      (1) Don't commit these changes to package-lock.json
      (2) You may want to reset these changes and run
          \`npm install\` again with ${ok_npm}
    `);

    // If you switch between Node projects and see this message often,
    // consider configuring `fnm` to change your Node version on `cd`.
    // More info: https://github.com/Schniz/fnm#shell-setup
  }

  console.warn(`${blu}
  --------------------------------------------------------------
  `);
}
