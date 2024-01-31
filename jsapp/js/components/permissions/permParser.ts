import permConfig from './permConfig';
import type {PermissionCodename} from './permConstants';
import {
  PARTIAL_PERM_PAIRS,
  CHECKBOX_NAMES,
  CHECKBOX_PERM_PAIRS,
} from './permConstants';
import {buildUserUrl, getUsernameFromUrl, ANON_USERNAME} from 'js/users/utils';
import type {
  PermissionResponse,
  PermissionBase,
  PartialPermission,
} from 'js/dataInterface';
import {
  getPartialByUsersListName,
  getPartialByUsersCheckboxName,
  getCheckboxNameByPermission,
} from './utils';

export interface UserPerm {
  /** Url of given permission instance (permission x user). */
  url: string;
  /** Url of given permission type. */
  permission: string;
  partial_permissions?: PartialPermission[];
}

export interface PermsFormData {
  /** Who give permissions to */
  username: string;
  formView?: boolean;
  formEdit?: boolean;
  formManage?: boolean;
  submissionsAdd?: boolean;
  submissionsView?: boolean;
  submissionsViewPartialByUsers?: boolean;
  submissionsViewPartialByUsersList?: string[];
  submissionsEdit?: boolean;
  submissionsEditPartialByUsers?: boolean;
  submissionsEditPartialByUsersList?: string[];
  submissionsDelete?: boolean;
  submissionsDeletePartialByUsers?: boolean;
  submissionsDeletePartialByUsersList?: string[];
  submissionsValidate?: boolean;
  submissionsValidatePartialByUsers?: boolean;
  submissionsValidatePartialByUsersList?: string[];
}

export interface UserWithPerms {
  user: {
    /** User url (identifier). */
    url: string;
    /** User name. */
    name: string;
    /** Marks user that owns an asset that the permissions are for. */
    isOwner: boolean;
  };
  /** A list of permissions for that user. */
  permissions: UserPerm[];
}

/**
 * Sort by abcs but keep the owner at the top. In comes possibly unsorted list,
 * out comes definitely sorted list.
 */
export function sortParseBackendOutput(
  output: UserWithPerms[]
): UserWithPerms[] {
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

function getPermUrl(permissionCodename: PermissionCodename): string {
  const permUrl =
    permConfig.getPermissionByCodename(permissionCodename)?.url || '';

  // This shouldn't really happen. But since we don't want to change BackendPerm
  // to allow undefined `permission` for TypeScript sake, we add this log here.
  if (permUrl === '') {
    console.error(
      `Permission URL for ${permissionCodename} not found in permConfig`
    );
  }

  return permUrl;
}

function buildBackendPerm(
  username: string,
  permissionCodename: PermissionCodename,
  partialPerms?: PartialPermission[]
): PermissionBase {
  const output: PermissionBase = {
    user: buildUserUrl(username),
    permission: getPermUrl(permissionCodename),
  };

  if (partialPerms) {
    output.partial_permissions = partialPerms;
  }

  return output;
}

/**
 * Removes contradictory permissions from the parsed list of BackendPerms.
 */
function removeContradictoryPerms(parsed: PermissionBase[]): PermissionBase[] {
  const contraPerms = new Set();
  parsed.forEach((backendPerm) => {
    const permDef = permConfig.getPermission(backendPerm.permission);
    permDef?.contradictory.forEach((contraPerm) => {
      contraPerms.add(contraPerm);
    });
  });
  parsed = parsed.filter(
    (backendPerm) => !contraPerms.has(backendPerm.permission)
  );
  return parsed;
}

/**
 * Removes implied permissions from the parsed list of BackendPerms.
 */
function removeImpliedPerms(parsed: PermissionBase[]): PermissionBase[] {
  const impliedPerms = new Set();
  parsed.forEach((backendPerm) => {
    const permDef = permConfig.getPermission(backendPerm.permission);
    permDef?.implied.forEach((impliedPerm) => {
      impliedPerms.add(impliedPerm);
    });
  });
  parsed = parsed.filter(
    (backendPerm) => !impliedPerms.has(backendPerm.permission)
  );
  return parsed;
}

/**
 * Builds (from form data) an object that Back-end endpoints can understand.
 * Removes contradictory and implied permissions from final output.
 */
export function parseFormData(data: PermsFormData): PermissionBase[] {
  let parsed = [];
  // Gather all partial permissions first, and then build a partial_submissions
  // grouped permission to add it to final data.
  const partialPerms: PartialPermission[] = [];

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
    const partialCheckboxName = getPartialByUsersCheckboxName(checkboxName);

    if (partialCheckboxName && data[partialCheckboxName]) {
      const permCodename = PARTIAL_PERM_PAIRS[partialCheckboxName];

      const listName = getPartialByUsersListName(partialCheckboxName);
      const partialUsers = data[listName] || [];

      partialPerms.push({
        url: getPermUrl(permCodename),
        filters: [{_submitted_by: {$in: partialUsers}}],
      });
    } else if (data[checkboxName]) {
      parsed.push(
        buildBackendPerm(data.username, CHECKBOX_PERM_PAIRS[checkboxName])
      );
    }
  });

  if (partialPerms.length >= 1) {
    const permObj = buildBackendPerm(
      data.username,
      'partial_submissions',
      partialPerms
    );
    parsed.push(permObj);
  }

  parsed = removeContradictoryPerms(parsed);
  parsed = removeImpliedPerms(parsed);

  return parsed;
}

/**
 * Builds form data from list of permissions.
 */
export function buildFormData(
  permissions: UserPerm[],
  username?: string
): PermsFormData {
  const formData: PermsFormData = {
    username: username || '',
  };

  permissions.forEach((perm) => {
    if (perm.permission === getPermUrl('view_asset')) {
      formData.formView = true;
    }
    if (perm.permission === getPermUrl('change_asset')) {
      formData.formEdit = true;
    }
    if (perm.permission === getPermUrl('manage_asset')) {
      formData.formManage = true;
    }
    if (perm.permission === getPermUrl('partial_submissions')) {
      perm.partial_permissions?.forEach((partial) => {
        const permDef = permConfig.getPermission(partial.url);
        if (!permDef) {
          return;
        }
        const nonPartialCheckboxName = getCheckboxNameByPermission(
          permDef.codename
        );
        if (!nonPartialCheckboxName) {
          return;
        }
        const partialCheckboxName = getPartialByUsersCheckboxName(
          nonPartialCheckboxName
        );
        if (!partialCheckboxName) {
          return;
        }

        formData[partialCheckboxName] = true;

        partial.filters.forEach((filter) => {
          if (filter._submitted_by) {
            const listName = getPartialByUsersListName(partialCheckboxName);
            formData[listName] = filter._submitted_by.$in;
          }
        });
      });
    }
    if (perm.permission === getPermUrl('add_submissions')) {
      formData.submissionsAdd = true;
    }
    if (perm.permission === getPermUrl('view_submissions')) {
      formData.submissionsView = true;
    }
    if (perm.permission === getPermUrl('change_submissions')) {
      formData.submissionsEdit = true;
    }
    if (perm.permission === getPermUrl('delete_submissions')) {
      formData.submissionsDelete = true;
    }
    if (perm.permission === getPermUrl('validate_submissions')) {
      formData.submissionsValidate = true;
    }
  });

  return formData;
}

/**
 * Builds a flat array of permissions for Backend endpoint from a list produced by `parseBackendData`
 */
export function parseUserWithPermsList(
  data: UserWithPerms[]
): PermissionBase[] {
  const output: PermissionBase[] = [];
  data.forEach((item) => {
    item.permissions.forEach((itemPerm) => {
      const outputPerm: PermissionBase = {
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
 * Groups raw Backend permissions list data into array of users who have a list
 * of permissions.
 */
export function parseBackendData(
  /** Permissions array (results property from endpoint response) */
  data: PermissionResponse[],
  /** Asset owner url (used as identifier) */
  ownerUrl: string,
  /** Whether to include permissions assigned to the anonymous user */
  includeAnon = false
): UserWithPerms[] {
  const output: UserWithPerms[] = [];

  const groupedData: {[userName: string]: UserPerm[]} = {};
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
      partial_permissions: item.partial_permissions
        ? item.partial_permissions
        : undefined,
    });
  });

  Object.keys(groupedData).forEach((userUrl) => {
    output.push({
      user: {
        url: userUrl,
        name: getUsernameFromUrl(userUrl) || '',
        // not all endpoints return user url in the v2 format, so as a fallback
        // we also check plain old usernames
        isOwner:
          userUrl === ownerUrl ||
          getUsernameFromUrl(userUrl) === getUsernameFromUrl(ownerUrl),
      },
      permissions: groupedData[userUrl],
    });
  });

  return sortParseBackendOutput(output);
}
