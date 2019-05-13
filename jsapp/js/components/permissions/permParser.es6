import permConfig from './permConfig';

function parse (permissions) {
  const config = permConfig.getConfig();
  return permissions;
}

module.exports = {
  parse: parse
};
