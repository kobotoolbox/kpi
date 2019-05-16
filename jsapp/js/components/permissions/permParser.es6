import permConfig from './permConfig';
import {PERMISSIONS} from '../../constants';

/*
 * Builds an API call compatible object from form data
 */
function parseFormData (data) {
  const config = permConfig.getAvailablePermissions();
  console.log('parseFormData', PERMISSIONS.get('view_asset'));
  return data;
}

/*
 * Builds a form data object from API data
 */
function parseBackendData (data) {
  const config = permConfig.getAvailablePermissions();
  return data;
}

module.exports = {
  parseFormData: parseFormData,
  parseBackendData: parseBackendData
};
