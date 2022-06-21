/* generate-build-version.js */

const fs = require('fs');
const packageJson = require('../package.json');

const appVersion = packageJson.version;

const jsonData = {
  version: appVersion
};

var jsonContent = JSON.stringify(jsonData);

fs.writeFile('./static/meta.json', jsonContent, 'utf8', function(err) {
  if (err) {
    console.log('An error occured while writing JSON Object to meta.json');
    return console.log(err);
  }

  console.log('meta.json file has been saved with latest version number');
});

return true