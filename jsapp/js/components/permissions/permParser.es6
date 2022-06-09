import permConfig from './permConfig';
import {
  ANON_USERNAME,
  PERMISSIONS_CODENAMES,
} from 'js/constants';
import {
  SUFFIX_PARTIAL,
  SUFFIX_USERS,
  PARTIAL_CHECKBOX_PAIRS,
  PARTIAL_PERM_PAIRS,
  CHECKBOX_NAMES,
  CHECKBOX_PERM_PAIRS,
  PERM_CHECKBOX_PAIRS,
} from './permConstants';
import {
  buildUserUrl,
  getUsernameFromUrl,
} from 'utils';

/**
 * @typedef {Object} BackendPerm
 * @property {string} user - User url.
 * @property {string} permission - Permission url.
 */

/**
 * @typedef {Object} FormData  - Object containing data from the UserAssetPermsEditor form.
 * @property {string} data.username - Who give permissions to.
 * @property {boolean} data.formView
 * @property {boolean} data.formEdit
 * @property {boolean} data.formManage
 * @property {boolean} data.submissionsAdd
 * @property {boolean} data.submissionsView
 * @property {boolean} data.submissionsViewPartial
 * @property {string[]} data.submissionsViewPartialUsers
 * @property {boolean} data.submissionsEdit
 * @property {boolean} data.submissionsEditPartial
 * @property {string[]} data.submissionsEditPartialUsers
 * @property {boolean} data.submissionsDelete
 * @property {boolean} data.submissionsDeletePartial
 * @property {string[]} data.submissionsDeletePartialUsers
 * @property {boolean} data.submissionsValidate
 * @property {boolean} data.submissionsValidatePartial
 * @property {string[]} data.submissionsValidatePartialUsers
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
  // Gather all partial permissions first, and then build a partial_submissions
  // grouped permission to add it to final data.
  let partialPerms = [];

  [
    CHECKBOX_NAMES.formView,
    CHECKBOX_NAMES.formEdit,
    CHECKBOX_NAMES.formManage,
    CHECKBOX_NAMES.submissionsAdd,
    CHECKBOX_NAMES.submissionsView,
    CHECKBOX_NAMES.submissionsEdit,
    CHECKBOX_NAMES.submissionsValidate,
    CHECKBOX_NAMES.submissionsDelete,
  ].forEach((checkboxName) => {
    const partialCheckboxName = PARTIAL_CHECKBOX_PAIRS[checkboxName];

    if (data[partialCheckboxName]) {
      const permCodename = PARTIAL_PERM_PAIRS[partialCheckboxName];
      partialPerms.push({
        url: permConfig.getPermissionByCodename(permCodename).url,
        filters: [{'_submitted_by': {'$in': data[partialCheckboxName + SUFFIX_USERS]}}],
      });
    } else if (data[checkboxName]) {
      parsed.push(buildBackendPerm(data.username, CHECKBOX_PERM_PAIRS[checkboxName]));
    }
  });

  if (partialPerms.length >= 1) {
    const permObj = buildBackendPerm(data.username, PERMISSIONS_CODENAMES.partial_submissions);
    permObj.partial_permissions = partialPerms;
    parsed.push(permObj);
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
    permission: permConfig.getPermissionByCodename(permissionCodename).url,
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
      perm.partial_permissions.forEach((partial) => {
        const permDef = permConfig.getPermission(partial.url);
        const checkboxName = PERM_CHECKBOX_PAIRS[permDef.codename] + SUFFIX_PARTIAL;

        formData[checkboxName] = true;

        partial.filters.forEach((filter) => {
          if (filter._submitted_by) {
            formData[checkboxName + SUFFIX_USERS] = filter._submitted_by.$in;
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
      partial_permissions: item.partial_permissions ? item.partial_permissions : undefined,
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
        ),
      },
      permissions: groupedData[userUrl],
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
  sortParseBackendOutput: sortParseBackendOutput, // for testing purposes
};
