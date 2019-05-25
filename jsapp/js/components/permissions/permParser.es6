import permConfig from './permConfig';
import {
  PERMISSIONS_CODENAMES,
  ANON_USERNAME
} from 'js/constants';
import {
  getUsernameFromUrl
} from 'js/utils';

/*
 * Builds an object understandable by Backend endpoints from form data.
 *
 * @param {Object} data - Object containing data from the UserPermissionsEditor form.
 * @param {string} data.username - Who give permissions to.
 * @param {boolean} data.formView - Is able to view forms.
 * @param {boolean} data.formEdit - Is able to edit forms.
 * @param {boolean} data.submissionsView - Is able to view submissions.
 * @param {boolean} data.submissionsViewPartial - If true, then able to view submissions only of some users.
 * @param {string[]} data.submissionsViewPartialUsers - Users mentioned in the above line.
 * @param {boolean} data.submissionsAdd - Is able to add submissions.
 * @param {boolean} data.submissionsEdit - Is able to edit submissions.
 * @param {boolean} data.submissionsValidate - Is able to validate submissions.
 */
function parseFormData (data) {
  const config = permConfig.getAvailablePermissions();
  console.log('parseFormData', PERMISSIONS_CODENAMES.get('view_asset'));
  return data;
}

/*
 * Builds a form data object from API data.
 *
 * @param {Object} data - Permissions array (results property from endpoint response).
 * @param {string} ownerUrl - Asset owner url (used as identifier).
 */
function parseBackendData (data, ownerUrl) {
  console.debug('TODO: here or some other place: hide permissions that are not for given asset kind');

  const output = [];

  const groupedData = {};
  data.forEach((item) => {
    // anonymous user permissions are our inner way of handling public sharing
    // so we don't want to display them
    if (getUsernameFromUrl(item.user) === ANON_USERNAME) {
      return;
    }
    if (!groupedData[item.user]) {
      groupedData[item.user] = [];
    }
    groupedData[item.user].push({
      url: item.url,
      name: permConfig.getPermissionName(item.permission),
      description: permConfig.getPermissionDescription(item.permission),
      permission: item.permission
    });
  });

  Object.keys(groupedData).forEach((userUrl) => {
    output.push({
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

  return output;
}

module.exports = {
  parseFormData: parseFormData,
  parseBackendData: parseBackendData
};
