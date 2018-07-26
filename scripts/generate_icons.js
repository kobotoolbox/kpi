const webfontsGenerator = require('webfonts-generator');
const fs = require('fs');
const sourceDir = 'jsapp/svg-icons/';
const destDir = 'jsapp/fonts/';

console.warn(
  '\x1b[31m***\n',
  'Please make sure SVGs are at least 1200px in size! Otherwise glyphs will look terrible during svg2ttf conversion.',
  '\n***',
  '\x1b[0m'
);

console.info('Reading files…');
const files = [];
fs.readdirSync(sourceDir).forEach(file => {
  if (file.endsWith('.svg')) {
    files.push(`${sourceDir}${file}`);
  }
})
console.info(`${files.length} SVGs found.`)

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
    htmlTemplate: './jsapp/k-icons-html-template.hbs',
    types: ['eot', 'svg', 'ttf', 'woff2', 'woff'],
    order: ['woff2', 'woff', 'ttf', 'eot', 'svg'],
    templateOptions: {
      classPrefix: 'k-icon-',
      baseSelector: '.k-icon',
      baseClassName: 'k-icon'
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
        ascent: 0
      },
      ttf: {},
      woff2: {},
      woff: {},
      eot: {}
    }
  },
  function(error) {
    if (error) {
      throw new Error('Fail!', error);
    } else {
      try {
        fs.copyFileSync(`${destDir}k-icons.css`, `${destDir}_k-icons.scss`);
        console.info('Copied k-icons.css to _k-icons.scss in fonts folder.');
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
