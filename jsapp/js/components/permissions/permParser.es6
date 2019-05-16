import permConfig from './permConfig';

/*
 * Builds an API call compatible object from form data
 */
function parseFormData (data) {
  const config = permConfig.getConfig();
  return data;
}

/*
 * Builds a form data object from API data
 */
function parseBackendData (data) {
  const config = permConfig.getConfig();
  return data;
}

module.exports = {
  parseFormData: parseFormData,
  parseBackendData: parseBackendData
};
