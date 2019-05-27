import permConfig from './permConfig';
import {
  ANON_USERNAME,
  PERMISSIONS_CODENAMES
} from 'js/constants';
import {
  buildUserUrl,
  getUsernameFromUrl
} from 'js/utils';

/**
 * @typedef {Object} BackendPerm
 * @property {string} user - User url.
 * @property {string} permission - Permission url.
 */

/**
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
 *
 * @returns {BackendPerm[]} - An array of permissions to be given.
 */
function parseFormData (data) {
  const parsed = [];

  if (data.formView) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.get('view_asset')));
  }

  if (data.formEdit) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.get('change_asset')));
  }

  if (data.submissionsViewPartial) {
    let permObj = buildBackendPerm(data.username, PERMISSIONS_CODENAMES.get('partial_submissions'));
    permObj.partial_permissions = [{
      url: permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.get('view_submissions')).url,
      filters: [{'_submitted_by': {'$in': data.submissionsViewPartialUsers}}]
    }];
    parsed.push(permObj);
  } else if (data.submissionsView) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.get('view_submissions')));
  }

  if (data.submissionsAdd) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.get('add_submissions')));
  }

  if (data.submissionsEdit) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.get('change_submissions')));
  }

  if (data.submissionsValidate) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.get('validate_submissions')));
  }

  // TODO 1: cleanup implied
  // TODO 2: cleanup contradictory

  return parsed;
}

function buildBackendPerm(username, permissionCodename) {
  return {
    user: buildUserUrl(username),
    permission: permConfig.getPermissionByCodename(permissionCodename).url
  };
}

/**
 * @typedef {Object} UserPerm
 * @property {string} url - Url of given permission instance (permission x user).
 * @property {string} name - Permission name.
 * @property {string} description - Permission user-friendly description.
 * @property {string} permission - Url of given permission type.
 */

/**
 * @typedef {Object} UserWithPerms
 * @property {Object} user
 * @property {string} user.url - User url (identifier).
 * @property {string} user.name - User name.
 * @property {boolean} user.isOwner - Marks user that owns an asset that the permissions are for.
 * @property {UserPerm[]} permissions - A list of permissions for that user.
 */

/**
 * Builds a form data object from API data.
 *
 * @param {Object} data - Permissions array (results property from endpoint response).
 * @param {string} ownerUrl - Asset owner url (used as identifier).
 *
 * @returns {UserWithPerms[]} An list of users with all their permissions.
 */
function parseBackendData (data, ownerUrl) {
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
    const permDef = permConfig.getPermission(item.permission);
    groupedData[item.user].push({
      url: item.url,
      name: permDef.name || permDef.codename, // fallback to codename if empty string
      description: permDef.description,
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
