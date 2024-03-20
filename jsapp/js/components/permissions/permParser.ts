import isEqual from 'lodash.isequal';
import clonedeep from 'lodash.clonedeep';
import permConfig from './permConfig';
import type {
  PermissionCodename,
  CheckboxNameAll,
  CheckboxNamePartialByUsers,
  CheckboxNamePartialByResponses,
} from './permConstants';
import {
  PARTIAL_BY_USERS_PERM_PAIRS,
  PARTIAL_BY_RESPONSES_PERM_PAIRS,
  CHECKBOX_PERM_PAIRS,
} from './permConstants';
import {buildUserUrl, getUsernameFromUrl, ANON_USERNAME} from 'js/users/utils';
import type {
  PermissionResponse,
  PermissionBase,
  PartialPermission,
  PartialPermissionFilter,
} from 'js/dataInterface';
import {
  getCheckboxNameByPermission,
  getPartialByUsersCheckboxName,
  getPartialByUsersListName,
  getPartialByResponsesCheckboxName,
  getPartialByResponsesQuestionName,
  getPartialByResponsesValueName,
  getPartialByUsersFilterList,
  getPartialByResponsesFilter,
} from './utils';

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
  submissionsViewPartialByResponses?: boolean;
  submissionsViewPartialByResponsesQuestion?: string;
  submissionsViewPartialByResponsesValue?: string;
  submissionsEdit?: boolean;
  submissionsEditPartialByUsers?: boolean;
  submissionsEditPartialByUsersList?: string[];
  submissionsEditPartialByResponses?: boolean;
  submissionsEditPartialByResponsesQuestion?: string;
  submissionsEditPartialByResponsesValue?: string;
  submissionsDelete?: boolean;
  submissionsDeletePartialByUsers?: boolean;
  submissionsDeletePartialByUsersList?: string[];
  submissionsDeletePartialByResponses?: boolean;
  submissionsDeletePartialByResponsesQuestion?: string;
  submissionsDeletePartialByResponsesValue?: string;
  submissionsValidate?: boolean;
  submissionsValidatePartialByUsers?: boolean;
  submissionsValidatePartialByUsersList?: string[];
  submissionsValidatePartialByResponses?: boolean;
  submissionsValidatePartialByResponsesQuestion?: string;
  submissionsValidatePartialByResponsesValue?: string;
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
  permissions: PermissionResponse[];
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
 * Removes contradictory permissions from the parsed list of BackendPerms. This
 * is mostly needed for safety reasons, cleaning up some permissions that don't
 * make sense.
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
 * Removes all redundant (implied) filters and permissions from a list of
 * partial permissions.
 */
export function removeImpliedPartialPerms(
  partialPerms: PartialPermission[]
): PartialPermission[] {
  // Step 1. Don't mutate things
  let perms = clonedeep(partialPerms);

  // Step 2. Gather all implied permissions x filters pairs.
  const redundantFilters: Array<{
    permUrl: string;
    filter: PartialPermissionFilter;
  }> = [];
  perms.forEach((partialPerm) => {
    const permDef = permConfig.getPermission(partialPerm.url);
    permDef?.implied.forEach((impliedPerm) => {
      partialPerm.filters.forEach((filter) => {
        redundantFilters.push({
          permUrl: impliedPerm,
          filter: filter,
        });
      });
    });
  });

  // Step 3. Traverse through partial permissions again, this time removing all
  // filters found in `redundantFilters`, and all permissions with empty
  // filters (meaning all filters for that permissions are implied, so whole
  // permission is in fact implied).
  perms = perms.filter((partialPerm) => {
    const currentPermUrl = partialPerm.url;

    // Remove given filter for given permission if it's on the list
    partialPerm.filters = partialPerm.filters.filter(
      (item) =>
        !redundantFilters.some((redundantFilter) =>
          isEqual(redundantFilter, {permUrl: currentPermUrl, filter: item})
        )
    );

    // if filters array is empty, remove whole permission
    return partialPerm.filters.length !== 0;
  });

  return perms;
}

/**
 * Removes implied permissions from the parsed list of BackendPerms. Also
 * removes any implied partial permissions (technically removes implied filters)
 * from within any single `partial_permissions`
 */
export function removeImpliedPerms(parsed: PermissionBase[]): PermissionBase[] {
  // Step 1. Loop through all given permissions and store all implied perms they
  // have (as a flat list in `impliedPerms`).
  const impliedPerms = new Set();
  parsed.forEach((backendPerm) => {
    const permDef = permConfig.getPermission(backendPerm.permission);
    permDef?.implied.forEach((impliedPerm) => {
      impliedPerms.add(impliedPerm);
    });
  });

  // Step 2. We remove implied from the outcome list
  const output = parsed.filter(
    (backendPerm) => !impliedPerms.has(backendPerm.permission)
  );

  // Step 3. Remove implied permissions for each `partial_submissions` left
  output.forEach((backendPerm) => {
    const permDef = permConfig.getPermission(backendPerm.permission);
    if (
      permDef?.codename === 'partial_submissions' &&
      backendPerm.partial_permissions
    ) {
      backendPerm.partial_permissions = removeImpliedPartialPerms(
        backendPerm.partial_permissions
      );
    }
  });

  return output;
}

/**
 * Builds (from form data) an object that Back-end endpoints can understand.
 * Removes contradictory and implied permissions from final output.
 */
export function parseFormData(data: PermsFormData): PermissionBase[] {
  let parsed = [];

  // We need to gather all partial permissions first, because they end up as
  // single `partial_submissions` permission with all partial permissions
  // grouped inside of it.
  const partialPerms: PartialPermission[] = [];

  // Step 1: Gather all partial "by users" permissions
  for (const [checkboxName, permCodename] of Object.entries(
    PARTIAL_BY_USERS_PERM_PAIRS
  )) {
    const byUsersCheckboxName = checkboxName as CheckboxNamePartialByUsers;
    if (data[byUsersCheckboxName]) {
      const listName = getPartialByUsersListName(byUsersCheckboxName);
      const partialUsers = data[listName] || [];

      // For one user it will be string, for multiple it will be an `$in` object
      const submittedByValue =
        partialUsers.length === 1 ? partialUsers[0] : {$in: partialUsers};

      partialPerms.push({
        url: getPermUrl(permCodename),
        filters: [{_submitted_by: submittedByValue}],
      });
    }
  }

  // Step 2: Gather all partial "by responses" permissions
  for (const [checkboxName, permCodename] of Object.entries(
    PARTIAL_BY_RESPONSES_PERM_PAIRS
  )) {
    const byResponsesCheckboxName =
      checkboxName as CheckboxNamePartialByResponses;
    if (data[byResponsesCheckboxName]) {
      const questionProp = getPartialByResponsesQuestionName(
        byResponsesCheckboxName
      );
      const question = data[questionProp];
      const valueProp = getPartialByResponsesValueName(byResponsesCheckboxName);
      const value = data[valueProp]; // this can be empty string (and it's ok)

      if (question) {
        const filter: PartialPermissionFilter = {[question]: value};
        const permUrl = getPermUrl(permCodename);

        // Step 2.1A: See if this permission is already in `partialPerms` - if
        // such is the case, we will merge the filters, instead of creating
        // separate permission
        // NOTE: this is intentional (always producing AND instead of OR) and
        // might be changed or extended in the future
        const foundPerm = partialPerms.find(
          (partialPerm) => partialPerm.url === permUrl
        );
        // We are purposefully interested in first filter only, as UI is not
        // able to handle OR filters (multiple filters)
        const foundPermFilter = foundPerm?.filters[0];
        if (foundPermFilter) {
          // We merge current filter into the existing one
          foundPerm.filters[0] = {...foundPermFilter, ...filter};
        } else {
          // Step 2.1B: If this is new permission, we simply add it
          partialPerms.push({
            url: permUrl,
            filters: [filter],
          });
        }
      }
    }
  }

  // Step 3: Build final partial permission
  if (partialPerms.length >= 1) {
    const permObj = buildBackendPerm(
      data.username,
      'partial_submissions',
      partialPerms
    );
    parsed.push(permObj);
  }

  // Step 4: Gather all non-partial permissions
  for (const [checkboxNameString, permCodename] of Object.entries(
    CHECKBOX_PERM_PAIRS
  )) {
    const checkboxName = checkboxNameString as CheckboxNameAll;
    if (
      data[checkboxName] &&
      // Filter out partial checkboxes
      checkboxName in PARTIAL_BY_USERS_PERM_PAIRS === false &&
      checkboxName in PARTIAL_BY_RESPONSES_PERM_PAIRS === false
    ) {
      parsed.push(buildBackendPerm(data.username, permCodename));
    }
  }

  // Step 5. Remove contradictory and implied permissions
  parsed = removeContradictoryPerms(parsed);
  parsed = removeImpliedPerms(parsed);

  return parsed;
}

/**
 * Builds form data from a list of permissions. It will only produce data for
 * the properties that comes directly from these permissions, i.e. there will
 * be nothing in returned object that comes from implied permissions. Other
 * functions are ensuring that (see `applyValidityRules` function from
 * `userAssetPermsEditor.utils.ts` file).
 */
export function buildFormData(
  permissions: PermissionResponse[],
  username?: string
): PermsFormData {
  const formData: PermsFormData = {
    username: username || '',
  };

  // The UI code is confused when it gets all implied permissions together with
  // the "actual" ones, so we need to do some cleanup first
  const deimpliedPerms = removeImpliedPerms(permissions);

  deimpliedPerms.forEach((perm) => {
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
        // Step 1. For each partial permission we start off getting the nested
        // definition, so we can get the codename from it
        const permDef = permConfig.getPermission(partial.url);
        if (!permDef) {
          return;
        }

        // Step 2. Using the codename, we get the matching non-partial checkbox
        // name - we will need it later
        const nonPartialCheckboxName = getCheckboxNameByPermission(
          permDef.codename
        );
        if (!nonPartialCheckboxName) {
          return;
        }

        // Step 3.  We assume here that there might be a case of 1 or 2 filters
        // tops. There might be one "by users" or one "by responses" or one each
        // - no other possiblities can happen. We get each of them separately
        // and try to put them back as form data:
        const byUsersFilterList = getPartialByUsersFilterList(partial);
        const byResponsesFilter = getPartialByResponsesFilter(partial);

        // Step 4. Handle "by users" filter (if one exists for this permission)
        if (byUsersFilterList) {
          const byUsersCheckboxName = getPartialByUsersCheckboxName(
            nonPartialCheckboxName
          );
          if (byUsersCheckboxName) {
            const byUsersListName =
              getPartialByUsersListName(byUsersCheckboxName);

            // Step 4A. Set the list of usernames
            const filterUsernames = byUsersFilterList;
            formData[byUsersListName] = filterUsernames;

            // Step 4B. Enable "by users" checkbox (but only if the users list
            // is not empty - in theory should not happen)
            formData[byUsersCheckboxName] = filterUsernames.length > 0;
          }
        }

        // Step 5. Handle "by responses" filter (if one exists for this
        // permission)
        if (byResponsesFilter) {
          const byResponsesCheckboxName = getPartialByResponsesCheckboxName(
            nonPartialCheckboxName
          );
          if (byResponsesCheckboxName) {
            const byResponsesQuestionName = getPartialByResponsesQuestionName(
              byResponsesCheckboxName
            );
            const byResponsesValueName = getPartialByResponsesValueName(
              byResponsesCheckboxName
            );

            // Step 5A. Set question name
            // Note that there is always one key with one value in this object,
            // so that we can go with `[0]` without risk
            formData[byResponsesQuestionName] =
              Object.keys(byResponsesFilter)[0];
            const value = Object.values(byResponsesFilter)[0];
            if (typeof value === 'string') {
              // Step 5B. Set value
              formData[byResponsesValueName] = value;
            }

            // Step 5C. Enable "by responses" checkbox (but only if question
            // name is defined, value might be an empty string)
            formData[byResponsesCheckboxName] = Boolean(
              formData[byResponsesQuestionName]
            );
          }
        }
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
  perms: PermissionResponse[],
  /** Asset owner url (used as identifier) */
  ownerUrl: string,
  /** Whether to include permissions assigned to the anonymous user */
  includeAnon = false
): UserWithPerms[] {
  const output: UserWithPerms[] = [];

  const groupedData: {[userName: string]: PermissionResponse[]} = {};
  perms.forEach((perm) => {
    // anonymous user permissions are our inner way of handling public sharing
    if (getUsernameFromUrl(perm.user) === ANON_USERNAME && !includeAnon) {
      return;
    }
    if (!groupedData[perm.user]) {
      groupedData[perm.user] = [];
    }
    groupedData[perm.user].push(perm);
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
