import permConfig from './permConfig';

function parse (permissions) {
  const config = permConfig.getConfig();
  console.log('parse', config, permissions);
  return permissions;
}

module.exports = {
  parse: parse
};
