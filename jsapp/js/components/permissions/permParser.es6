import permConfig from './permConfig';
import {PERMISSIONS} from '../../constants';
import {getUsernameFromUrl} from '../../utils';

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
  const parsedPerms = [];

  const groupedData = {};
  data.forEach((item) => {
    if (!groupedData[item.user]) {
      groupedData[item.user] = [];
    }
    groupedData[item.user].push({
      url: item.url,
      name: permConfig.getPermissionName(item.permission),
      permission: item.permission
    });
  });

  Object.keys(groupedData).forEach((userUrl) => {
    parsedPerms.push({
      user: {
        url: userUrl,
        name: getUsernameFromUrl(userUrl),
        isOwner: false
      },
      permissions: groupedData[userUrl]
    });
  });

  return parsedPerms;
}

module.exports = {
  parseFormData: parseFormData,
  parseBackendData: parseBackendData
};
