import permConfig from './permConfig';
import {
  ANON_USERNAME,
  PERMISSIONS_CODENAMES
} from 'js/constants';
import {
  buildUserUrl,
  getUsernameFromUrl
} from 'utils';

/**
 * @typedef {Object} BackendPerm
 * @property {string} user - User url.
 * @property {string} permission - Permission url.
 */

/**
 * @typedef {Object} FormData  - Object containing data from the UserAssetPermsEditor form.
 * @property {string} data.username - Who give permissions to.
 * @property {boolean} data.formView - Is able to view forms.
 * @property {boolean} data.formEdit - Is able to edit forms.
 * @property {boolean} data.formManage - Is able to change form permissions (and future stuff TBD).
 * @property {boolean} data.submissionsView - Is able to view submissions.
 * @property {boolean} data.submissionsViewPartial - If true, then able to view submissions only of some users.
 * @property {string[]} data.submissionsViewPartialUsers - Users mentioned in the above line.
 * @property {boolean} data.submissionsAdd - Is able to add submissions.
 * @property {boolean} data.submissionsEdit - Is able to edit submissions.
 * @property {boolean} data.submissionsValidate - Is able to validate submissions.
 */

/**
 * @typedef {Object} UserPerm
 * @property {string} url - Url of given permission instance (permission x user).
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
 * Builds an object understandable by Backend endpoints from form data.
 * Removes contradictory and implied permissions from final output.
 *
 * @param {FormData} data
 * @returns {BackendPerm[]} - An array of permissions to be given.
 */
function parseFormData(data) {
  let parsed = [];

  if (data.formView) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.view_asset));
  }

  if (data.formEdit) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.change_asset));
  }

  if (data.formManage) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.manage_asset));
  }

  if (data.submissionsViewPartial) {
    let permObj = buildBackendPerm(data.username, PERMISSIONS_CODENAMES.partial_submissions);
    permObj.partial_permissions = [{
      url: permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.view_submissions).url,
      filters: [{'_submitted_by': {'$in': data.submissionsViewPartialUsers}}]
    }];
    parsed.push(permObj);
  } else if (data.submissionsView) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.view_submissions));
  }

  if (data.submissionsAdd) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.add_submissions));
  }

  if (data.submissionsEdit) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.change_submissions));
  }

  if (data.submissionsDelete) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.delete_submissions));
  }

  if (data.submissionsValidate) {
    parsed.push(buildBackendPerm(data.username, PERMISSIONS_CODENAMES.validate_submissions));
  }

  parsed = removeContradictoryPerms(parsed);
  parsed = removeImpliedPerms(parsed);

  return parsed;
}

/**
 * Removes contradictory permissions from the parsed list of BackendPerms.
 *
 * @param {BackendPerm[]} parsed - A list of permissions.
 */
function removeContradictoryPerms(parsed) {
  let contraPerms = new Set();
  parsed.forEach((backendPerm) => {
    const permDef = permConfig.getPermission(backendPerm.permission);
    permDef.contradictory.forEach((contraPerm) => {
      contraPerms.add(contraPerm);
    });
  });
  parsed = parsed.filter((backendPerm) => {
    return !contraPerms.has(backendPerm.permission);
  });
  return parsed;
}

/**
 * Removes implied permissions from the parsed list of BackendPerms.
 *
 * @param {BackendPerm[]} parsed - A list of permissions.
 */
function removeImpliedPerms(parsed) {
  let impliedPerms = new Set();
  parsed.forEach((backendPerm) => {
    const permDef = permConfig.getPermission(backendPerm.permission);
    permDef.implied.forEach((impliedPerm) => {
      impliedPerms.add(impliedPerm);
    });
  });
  parsed = parsed.filter((backendPerm) => {
    return !impliedPerms.has(backendPerm.permission);
  });
  return parsed;
}

/**
 * @param {string} username
 * @param {string} permissionCodename
 * @returns {BackendPerm}
 */
function buildBackendPerm(username, permissionCodename) {
  return {
    user: buildUserUrl(username),
    permission: permConfig.getPermissionByCodename(permissionCodename).url
  };
}

/**
 * Builds form data from list of permissions.
 *
 * @param {UserPerm[]} permissions
 * @returns {FormData}
 */
function buildFormData(permissions) {
  const formData = {};

  permissions.forEach((perm) => {
    if (perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.view_asset).url) {
      formData.formView = true;
    }
    if (perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.change_asset).url) {
      formData.formEdit = true;
    }
    if (perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.manage_asset).url) {
      formData.formManage = true;
    }
    if (perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.partial_submissions).url) {
      formData.submissionsView = true;
      formData.submissionsViewPartial = true;
      perm.partial_permissions.forEach((partial) => {
        partial.filters.forEach((filter) => {
          if (filter._submitted_by) {
            formData.submissionsViewPartialUsers = filter._submitted_by.$in;
          }
        });
      });
    }
    if (perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.add_submissions).url) {
      formData.submissionsAdd = true;
    }
    if (perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.view_submissions).url) {
      formData.submissionsView = true;
    }
    if (perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.change_submissions).url) {
      formData.submissionsEdit = true;
    }
    if (perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.delete_submissions).url) {
      formData.submissionsDelete = true;
    }
    if (perm.permission === permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.validate_submissions).url) {
      formData.submissionsValidate = true;
    }
  });

  return formData;
}

/**
 * Builds a flat array of permissions for Backend endpoint
 *
 * @param {UserWithPerms[]} data - The one you get from parseBackendData
 * @returns {BackendPerm[]} A flat list of BackendPerms
 */
function parseUserWithPermsList(data) {
  const output = [];
  data.forEach((item) => {
    item.permissions.forEach((itemPerm) => {
      const outputPerm = {
        user: item.user.url,
        permission: itemPerm.permission,
      };
      if (itemPerm.partial_permissions) {
        outputPerm.partial_permissions = itemPerm.partial_permissions;
      }
      output.push(outputPerm);
    });
  });
  return output;
}

/**
 * Groups raw Backend permissions list data into array of users who have a list of permissions.
 *
 * @param {Object} data - Permissions array (results property from endpoint response).
 * @param {string} ownerUrl - Asset owner url (used as identifier).
 * @param {boolean} includeAnon - Whether to include permissions assigned to the anonymous user.
 *
 * @returns {UserWithPerms[]} An ordered list of users with all their permissions.
 */
function parseBackendData(data, ownerUrl, includeAnon = false) {
  const output = [];

  const groupedData = {};
  data.forEach((item) => {
    // anonymous user permissions are our inner way of handling public sharing
    if (getUsernameFromUrl(item.user) === ANON_USERNAME && !includeAnon) {
      return;
    }
    if (!groupedData[item.user]) {
      groupedData[item.user] = [];
    }
    groupedData[item.user].push({
      url: item.url,
      permission: item.permission,
      partial_permissions: item.partial_permissions ? item.partial_permissions : undefined
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

  return sortParseBackendOutput(output);
}

/**
 * Sort by abcs but keep the owner at the top.
 *
 * @param {UserWithPerms[]} output - Possibly unsorted.
 * @returns {UserWithPerms[]} - Definitely sorted.
 */
function sortParseBackendOutput(output) {
  return output.sort((a, b) => {
    if (a.user.isOwner) {
      return -1;
    } else if (b.user.isOwner) {
      return 1;
    } else if (a.user.url < b.user.url) {
      return -1;
    } else if (a.user.url > b.user.url) {
      return 1;
    } else {
      return 0;
    }
  });
}

export const permParser = {
  parseFormData: parseFormData,
  buildFormData: buildFormData,
  parseBackendData: parseBackendData,
  parseUserWithPermsList: parseUserWithPermsList,
  sortParseBackendOutput: sortParseBackendOutput // for testing purposes
};
