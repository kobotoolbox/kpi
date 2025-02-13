/*
 * This scripts generates icon font from our SVG icons to be used in the app.
 */

const webfontsGenerator = require('@vusion/webfonts-generator');
const replaceInFile = require('replace-in-file');
const fs = require('fs');
const sourceDir = 'jsapp/svg-icons/';
const destDir = 'jsapp/fonts/';

console.warn(
  '\x1b[31m***\n',
  'Please make sure SVGs are at least 280px in size! Otherwise glyphs will look terrible during svg2ttf conversion.',
  '\n***',
  '\x1b[0m'
);

console.info('Reading files…');
const files = [];
const icons = [];
fs.readdirSync(sourceDir).forEach((file) => {
  if (file.endsWith('.svg')) {
    files.push(`${sourceDir}${file}`);
    icons.push(file.replace('.svg', ''));
  }
});
console.info(`${files.length} SVGs found.`);

console.info('Generating fonts…');
webfontsGenerator(
  {
    files: files,
    dest: destDir,
    fontName: 'k-icons',
    cssFontsUrl: '../fonts/',
    css: true,
    cssTemplate: './jsapp/k-icons-css-template.hbs',
    html: true,
    types: ['eot', 'svg', 'ttf', 'woff2', 'woff'],
    order: ['woff2', 'woff', 'ttf', 'eot', 'svg'],
    templateOptions: {
      classPrefix: 'k-icon-',
      baseSelector: '.k-icon',
      baseClassName: 'k-icon',
    },
    formatOptions: {
      svg: {
        fontStyle: 'normal',
        fontWeight: 'normal',
        fixedWidth: true,
        centerHorizontally: false,
        normalize: false,
        height: 10000,
        round: 0,
        descent: 0,
        ascent: 0,
      },
      ttf: {},
      woff2: {},
      woff: {},
      eot: {},
    },
  },
  function (error) {
    if (error) {
      throw new Error('Fail!', error);
    } else {
      try {
        /*
         * We load styles by importing into React.
         * It puts the contents of the generated CSS in an inline style tag,
         * which somehow causes hash in query parameters to be lost.
         * Our HACKFIX is manually adding timestamps to filenames.
         */
        console.info('Adding timestamp to files…');
        const timestamp = Date.now();
        ['eot', 'svg', 'ttf', 'woff', 'woff2'].forEach((ext) => {
          const oldName = `k-icons.${ext}`;
          const newName = `k-icons.${timestamp}.${ext}`;
          fs.renameSync(`${destDir}${oldName}`, `${destDir}${newName}`);
          replaceInFile.sync({
            files: [`${destDir}k-icons.css`],
            // Use additional "?" to differentiate woff and woff2
            from: [`${oldName}?`],
            to: [`${newName}?`],
          });
        });

        /*
         * This is needed because we use @extend on k-icons selectors, and it
         * sadly doesn't work with a regular CSS file.
         */
        console.info('Copying k-icons.css to SCSS file…');
        fs.copyFileSync(`${destDir}k-icons.css`, `${destDir}k-icons.scss`);

        generateDefinitions(icons);
      } catch(e){
        console.warn(
          '\x1b[31m***\n',
          e,
          '\n***',
          '\x1b[0m'
        );
      }
    }
  }
);

/**
 * This makes a file with `export type IconName = 'one' | 'two' | …` and an
 * array of all names.
 */
function generateDefinitions(iconsList) {
  console.info('Generating definition file…');
  const typeParts = [];
  const enumParts = [];
  iconsList.forEach((iconName) => {
    typeParts.push(`'${iconName}'`);
    enumParts.push(`'${iconName}' = '${iconName}'`);
  });
  const fileContent = `export type IconName = ${typeParts.join(' | ')}
export enum IconNames {${enumParts.join(', ')}}`;

  fs.writeFile(`${destDir}/k-icons.ts`, fileContent, (err) => {
    if (err) {
      throw new Error('Fail!', err);
    }
  });
}
