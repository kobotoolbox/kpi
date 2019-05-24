import permConfig from './permConfig';
import {PERMISSIONS} from '../../constants';
import {
  anonUsername,
  getUsernameFromUrl
} from '../../utils';

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
function parseBackendData (data, ownerUrl) {
  // TODO: here or other place: hide permissions that are not for given asset kind
  const parsedPerms = [];

  const groupedData = {};
  data.forEach((item) => {
    // anonymous user permissions are for public sharing and we don't want to display them
    if (getUsernameFromUrl(item.user) === anonUsername) {
      return;
    }
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
        // not all endpoints return user url in the v2 format, so as a fallback
        // we also check plain old usernames
        isOwner: (
          userUrl === ownerUrl ||
          getUsernameFromUrl(userUrl) === getUsernameFromUrl(ownerUrl)
        )
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
