import sessionStore from 'js/stores/session';
import permConfig from './permConfig';
import {buildUserUrl, ANON_USERNAME_URL} from 'js/users/utils';
import type {
  AssetResponse,
  PermissionResponse,
  ProjectViewAsset,
  SubmissionResponse,
} from 'js/dataInterface';
import {isSelfOwned} from 'jsapp/js/assetUtils';
import type {
  PermissionCodename,
  CheckboxNameAll,
  CheckboxNamePartialByUsers,
  PartialByUsersListName,
  CheckboxNamePartialByResponses,
  PartialByResponsesQuestionName,
  PartialByResponsesValueName,
} from './permConstants';
import {
  CHECKBOX_PERM_PAIRS,
  CHECKBOX_LABELS,
  PARTIAL_BY_USERS_DEFAULT_LABEL,
  PARTIAL_BY_RESPONSES_DEFAULT_LABEL,
} from './permConstants';
import type {UserPerm} from './permParser';

/** For `.find`-ing the permissions */
function _doesPermMatch(
  perm: PermissionResponse,
  permName: PermissionCodename,
  partialPermName: PermissionCodename | null = null
) {
  // Case 1: permissions don't match, stop looking
  if (perm.permission !== permConfig.getPermissionByCodename(permName)?.url) {
    return false;
  }

  // Case 2: permissions match, and we're not looking for partial one
  if (permName !== 'partial_submissions') {
    return true;
  }

  // Case 3a: we are looking for partial permission, but the name was no given
  if (!partialPermName) {
    return false;
  }

  // Case 3b: we are looking for partial permission, check if there are some that match
  return perm.partial_permissions?.some(
    (partialPerm) =>
      partialPerm.url ===
      permConfig.getPermissionByCodename(partialPermName)?.url
  );
}

// NOTE: be aware of the fact that some of non-TypeScript code is passing
// things that are not AssetResponse (probably due to how dmix mixin is used
// - merging asset response directly into component state object)
export function userCan(
  permName: PermissionCodename,
  asset?: AssetResponse | ProjectViewAsset,
  partialPermName: PermissionCodename | null = null
) {
  // Sometimes asset data is not ready yet and we still call the function
  // through some rendering function. We have to be prepared
  if (!asset) {
    return false;
  }

  // TODO: check out whether any other checks are really needed at this point.
  // Pay attention if partial permissions work.
  if ('effective_permissions' in asset) {
    const hasEffectiveAccess = asset.effective_permissions?.some(
      (effectivePerm) => effectivePerm.codename === permName
    );
    if (hasEffectiveAccess) {
      return true;
    }
  }

  const currentUsername = sessionStore.currentAccount.username;

  // If you own the asset, you can do everything with it
  if (asset.owner__username === currentUsername) {
    return true;
  }

  if ('permissions' in asset) {
    // if permission is granted publicly, then grant it to current user
    const anonAccess = asset.permissions.some(
      (perm) =>
        perm.user === ANON_USERNAME_URL &&
        perm.permission === permConfig.getPermissionByCodename(permName)?.url
    );
    if (anonAccess) {
      return true;
    }

    return asset.permissions.some(
      (perm) =>
        perm.user === buildUserUrl(currentUsername) &&
        _doesPermMatch(perm, permName, partialPermName)
    );
  }

  return false;
}

export function userCanPartially(
  permName: PermissionCodename,
  asset?: AssetResponse
) {
  const currentUsername = sessionStore.currentAccount.username;

  // Owners cannot have partial permissions because they have full permissions.
  // Both are contradictory.
  if (asset?.owner__username === currentUsername) {
    return false;
  }

  return userCan('partial_submissions', asset, permName);
}

/**
 * This checks if current user can remove themselves from a project that was
 * shared with them. If `view_asset` comes from `asset.effective_permissions`,
 * but doesn't exist in `asset.permissions` it means that `view_asset` comes
 * from Project View access, not from project being shared with user directly.
 */
export function userCanRemoveSharedProject(asset: AssetResponse) {
  const currentUsername = sessionStore.currentAccount.username;
  const userHasDirectViewAsset = asset.permissions.some(
    (perm) =>
      perm.user === buildUserUrl(currentUsername) &&
      _doesPermMatch(perm, 'view_asset')
  );

  return (
    !isSelfOwned(asset) &&
    userCan('view_asset', asset) &&
    userHasDirectViewAsset
  );
}

/**
 * This implementation does not use the back end to detect if `submission`
 * is writable or not. So far, the front end only supports filters like:
 *    `_submitted_by: {'$in': []}`
 * Let's search for `submissions._submitted_by` value among these `$in`
 * lists.
 */
export function isSubmissionWritable(
  /** Permission to check if user can do at least partially */
  permName: PermissionCodename,
  asset: AssetResponse,
  submission: SubmissionResponse
) {
  // TODO optimize this to avoid calling `userCan()` and `userCanPartially()`
  // repeatedly in the table view
  // TODO Support multiple permissions at once
  const thisUserCan = userCan(permName, asset);
  const thisUserCanPartially = userCanPartially(permName, asset);

  // Case 1: User has full permission
  if (thisUserCan) {
    return true;
  }

  // Case 2: User has neither full nor partial permission
  if (!thisUserCanPartially) {
    return false;
  }

  // Case 3: User has only partial permission, and things are complicated
  const currentUsername = sessionStore.currentAccount.username;
  const partialPerms = asset.permissions.find(
    (perm) =>
      perm.user === buildUserUrl(currentUsername) &&
      _doesPermMatch(perm, 'partial_submissions', permName)
  );

  const partialPerm = partialPerms?.partial_permissions?.find(
    (nestedPerm) =>
      nestedPerm.url === permConfig.getPermissionByCodename(permName)?.url
  );

  const submittedBy = submission._submitted_by;
  // If ther `_submitted_by` was not stored, there is no way of knowing.
  if (submittedBy === null) {
    return false;
  }

  let allowedUsers: string[] = [];

  partialPerm?.filters.forEach((filter) => {
    if (filter._submitted_by) {
      allowedUsers = allowedUsers.concat(filter._submitted_by.$in);
    }
  });
  return allowedUsers.includes(submittedBy);
}

/**
 * For given checkbox name, it returns its partial "by users" counterpart -
 * another checkbox name (if there is one).
 */
export function getPartialByUsersCheckboxName(
  checkboxName: CheckboxNameAll
): CheckboxNamePartialByUsers | undefined {
  switch (checkboxName) {
    case 'submissionsView':
      return 'submissionsViewPartialByUsers';
    case 'submissionsEdit':
      return 'submissionsEditPartialByUsers';
    case 'submissionsValidate':
      return 'submissionsValidatePartialByUsers';
    case 'submissionsDelete':
      return 'submissionsDeletePartialByUsers';
    default:
      return undefined;
  }
}

/**
 * Matches given partial "by users" checkbox name with the list property name
 */
export function getPartialByUsersListName(
  checkboxName: CheckboxNamePartialByUsers
): PartialByUsersListName {
  switch (checkboxName) {
    case 'submissionsViewPartialByUsers':
      return 'submissionsViewPartialByUsersList';
    case 'submissionsEditPartialByUsers':
      return 'submissionsEditPartialByUsersList';
    case 'submissionsDeletePartialByUsers':
      return 'submissionsDeletePartialByUsersList';
    case 'submissionsValidatePartialByUsers':
      return 'submissionsValidatePartialByUsersList';
  }
}

/**
 * For given checkbox name, it returns its partial "by responses" counterpart -
 * another checkbox name (if there is one).
 */
export function getPartialByResponsesCheckboxName(
  checkboxName: CheckboxNameAll
): CheckboxNamePartialByResponses | undefined {
  switch (checkboxName) {
    case 'submissionsView':
      return 'submissionsViewPartialByResponses';
    case 'submissionsEdit':
      return 'submissionsEditPartialByResponses';
    case 'submissionsValidate':
      return 'submissionsValidatePartialByResponses';
    case 'submissionsDelete':
      return 'submissionsDeletePartialByResponses';
    default:
      return undefined;
  }
}

/**
 * Matches given partial "by responses" checkbox name with the question property
 * name
 */
export function getPartialByResponsesQuestionName(
  checkboxName: CheckboxNamePartialByResponses
): PartialByResponsesQuestionName {
  switch (checkboxName) {
    case 'submissionsViewPartialByResponses':
      return 'submissionsViewPartialByResponsesQuestion';
    case 'submissionsEditPartialByResponses':
      return 'submissionsEditPartialByResponsesQuestion';
    case 'submissionsDeletePartialByResponses':
      return 'submissionsDeletePartialByResponsesQuestion';
    case 'submissionsValidatePartialByResponses':
      return 'submissionsValidatePartialByResponsesQuestion';
  }
}

/**
 * Matches given partial "by responses" checkbox name with the value property
 * name
 */
export function getPartialByResponsesValueName(
  checkboxName: CheckboxNamePartialByResponses
): PartialByResponsesValueName {
  switch (checkboxName) {
    case 'submissionsViewPartialByResponses':
      return 'submissionsViewPartialByResponsesValue';
    case 'submissionsEditPartialByResponses':
      return 'submissionsEditPartialByResponsesValue';
    case 'submissionsDeletePartialByResponses':
      return 'submissionsDeletePartialByResponsesValue';
    case 'submissionsValidatePartialByResponses':
      return 'submissionsValidatePartialByResponsesValue';
  }
}

/**
 * For given permission name it returns a matching checkbox name (non-partial).
 * It should never return `undefined`, but TypeScript has some limitations.
 */
export function getCheckboxNameByPermission(
  permName: PermissionCodename
): CheckboxNameAll | undefined {
  let found: CheckboxNameAll | undefined;
  for (const [checkboxName, permissionName] of Object.entries(
    CHECKBOX_PERM_PAIRS
  )) {
    // We cast it here because for..of doesn't keep the type of the keys
    const checkboxNameCast = checkboxName as CheckboxNameAll;
    if (permName === permissionName) {
      found = checkboxNameCast;
    }
  }
  return found;
}

/**
 * A wrapper function for getting item from `CHECKBOX_LABELS`. If anything goes
 * awry, we will return checkbox name as fallback.
 */
export function getCheckboxLabel(checkboxName: CheckboxNameAll) {
  if (checkboxName in CHECKBOX_LABELS) {
    return CHECKBOX_LABELS[checkboxName];
  }
  return checkboxName;
}

/** Detect if permission is partial and of "by users" kind. */
export function isPartialByUsers(perm: UserPerm) {
  if (
    'partial_permissions' in perm &&
    Array.isArray(perm.partial_permissions) &&
    perm.partial_permissions[0]?.filters[0]
  ) {
    // We are looking for a filter with `$in` inside that points to an array of
    // strings. This assumes that we currently have only two kinds of partial
    // permissions and might require upgrading
    const filtersValues = Object.values(perm.partial_permissions[0].filters[0]);
    return filtersValues.some((filter) => '$in' in filter && Array.isArray(filter.$in));
  }

  return false;
}

/** Detect if permission is partial and of "by responses" kind. */
export function isPartialByResponses(perm: UserPerm) {
  if (
    'partial_permissions' in perm &&
    Array.isArray(perm.partial_permissions) &&
    perm.partial_permissions[0]?.filters[0]
  ) {
    // We are looking for a filter with `$eq` inside that points to a string.
    // This assumes that we currently have only two kinds of partial permissions
    // and might require upgrading
    const filtersValues = Object.values(perm.partial_permissions[0].filters[0]);
    return filtersValues.some((filter) => '$eq' in filter && typeof filter.$eq === 'string');
  }

  return false;
}

/**
 * Returns a human readable permission label, has to do some juggling for
 * partial permissions. Fallback is permission codename.
 */
export function getPermLabel(perm: UserPerm) {
  // For partial permissions we return a general label that matches all possible
  // partial permissions (i.e. same label for "View submissions only from
  // specific users" and "Edit submissions only from specific users" etc.)
  if (isPartialByUsers(perm)) {
    return PARTIAL_BY_USERS_DEFAULT_LABEL;
  } else if (isPartialByResponses(perm)) {
    return PARTIAL_BY_RESPONSES_DEFAULT_LABEL;
  }

  // Get permission definition
  const permDef = permConfig.getPermission(perm.permission);

  if (permDef) {
    const checkboxName = getCheckboxNameByPermission(permDef.codename);

    if (checkboxName && checkboxName in CHECKBOX_LABELS) {
      return getCheckboxLabel(checkboxName);
    }
  }

  // If we couldn't get the definition, we will display "???", so it's clear
  // something is terribly wrong. But this case is ~impossible to get, and we
  // mostly have it for TS reasons.
  return '???';
}

/**
 * Displays a user friendly name of given permission. For partial permissions it
 * will include the list of users (limited by `maxParentheticalUsernames`) in
 * the name.
 */
export function getFriendlyPermName(
  perm: UserPerm,
  maxParentheticalUsernames = 3
) {
  const permLabel = getPermLabel(perm);

  if (isPartialByUsers(perm)) {
    let permUsers: string[] = [];

    if (perm.partial_permissions) {
      perm.partial_permissions.forEach((partial) => {
        partial.filters.forEach((filter) => {
          if (filter._submitted_by) {
            permUsers = permUsers.concat(filter._submitted_by.$in);
          }
        });
      });
    }

    // Keep only unique values
    permUsers = [...new Set(permUsers)];

    // Hopefully this is friendly to translators of RTL languages
    let permNameTemplate;
    if (permUsers.length === 0) {
      permNameTemplate = '##permission_label##';
    } else if (permUsers.length <= maxParentheticalUsernames) {
      permNameTemplate = t('##permission_label## (##username_list##)');
    } else if (permUsers.length === maxParentheticalUsernames + 1) {
      permNameTemplate = t(
        '##permission_label## (##username_list## and 1 other)'
      );
    } else {
      permNameTemplate = t(
        '##permission_label## (##username_list## and ' +
          '##hidden_username_count## others)'
      );
    }

    return permNameTemplate
      .replace('##permission_label##', permLabel)
      .replace(
        '##username_list##',
        permUsers.slice(0, maxParentheticalUsernames).join(', ')
      )
      .replace(
        '##hidden_username_count##',
        String(permUsers.length - maxParentheticalUsernames)
      );
  }

  if (isPartialByResponses(perm)) {
    const firstFilter = perm.partial_permissions?.[0].filters[0];
    if (firstFilter) {
      const permQuestion = Object.keys(firstFilter)[0];
      const permValue = Object.values(firstFilter)[0]?.$eq;

      if (typeof permQuestion === 'string' && typeof permValue === 'string') {
        return t('##permission_label## ("##question_name##" equals "##value##")')
          .replace('##permission_label##', permLabel)
          .replace('##question_name##', permQuestion)
          .replace('##value##', permValue);
      }
    }
  }

  return permLabel;
}
