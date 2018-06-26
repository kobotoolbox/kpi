const webfontsGenerator = require('webfonts-generator');
const fs = require('fs');
const sourceDir = 'jsapp/svg-icons/';
const destDir = 'temp-fonts/';

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
    css: true,
    html: true,
    types: ['eot', 'svg', 'ttf', 'woff2', 'woff'],
    templateOptions: {
      classPrefix: 'k-icon-',
      baseSelector: '.k-icon'
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
