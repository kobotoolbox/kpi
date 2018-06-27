const webfontsGenerator = require('webfonts-generator');
const fs = require('fs');
const sourceDir = 'jsapp/svg-icons/';
const destDir = 'jsapp/fonts/';

const files = [];
fs.readdirSync(sourceDir).forEach(file => {
  if (file.endsWith('.svg')) {
    files.push(`${sourceDir}${file}`);
  }
})

webfontsGenerator(
  {
    files: files,
    dest: destDir,
    fontName: 'k-icons',
    cssFontsPath: '../fonts/',
    css: true,
    cssTemplate: './jsapp/k-icons-css-template.hbs',
    html: true,
    htmlTemplate: './jsapp/k-icons-html-template.hbs',
    types: ['eot', 'svg', 'ttf', 'woff2', 'woff'],
    templateOptions: {
      classPrefix: 'k-icon-',
      baseSelector: '.k-icon',
      baseClassName: 'k-icon'
    },
    formatOptions: {
      svg: {
        normalize: false,
        round: 10e99,
      },
      ttf: {},
      woff2: {},
      woff: {},
      eot: {}
    }
  },
  function(error) {
    if (error) {
      console.log('Fail!', error);
    } else {
      fs.copyFileSync(`${destDir}k-icons.css`, `${destDir}_k-icons.scss`);
      console.log('Done!');
    }
  }
);
