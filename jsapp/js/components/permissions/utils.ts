import clonedeep from 'lodash.clonedeep';
import sessionStore from 'js/stores/session';
import permConfig from './permConfig';
import {buildUserUrl, ANON_USERNAME_URL} from 'js/users/utils';
import type {
  AssetResponse,
  PartialPermissionFilter,
  PartialPermissionFilterByUsers,
  PartialPermissionFilterByResponses,
  PartialPermission,
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
  PARTIAL_BY_MULTIPLE_LABEL,
  PARTIAL_BY_USERS_LABEL,
  PARTIAL_BY_RESPONSES_LABEL,
} from './permConstants';

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

/** Detects if given filter is of "by users" kind. */
export function isPartialByUsersFilter(filter: PartialPermissionFilter) {
  return (
    // We are lookin for object with `_submitted_by` property…
    ('_submitted_by' in filter &&
      // …and value being an object with `$in` pointing at an array of usernames,
      // or simply a string (single username)
      typeof filter._submitted_by === 'object' &&
      '$in' in filter._submitted_by &&
      Array.isArray(filter._submitted_by.$in) &&
      filter._submitted_by.$in.length !== 0) ||
    ('_submitted_by' in filter &&
      typeof filter._submitted_by === 'string' &&
      filter._submitted_by.length !== 0)
  );
}

/**
 * Finds "by users" filter inside the partial permission and returns the users
 * list from it. If there is no "by users" filter we return `undefined`.
 */
export function getPartialByUsersFilterList(
  partialPerm: PartialPermission
): string[] | undefined {
  let found: PartialPermissionFilterByUsers | undefined;

  partialPerm.filters.forEach((filter) => {
    if (isPartialByUsersFilter(filter)) {
      // We cast the type, because we checked with `isPartialByUsersFilter`
      found = filter as PartialPermissionFilterByUsers;
    }
  });

  if (!found) {
    return undefined;
  } else if (typeof found._submitted_by === 'string') {
    return [found._submitted_by];
  } else if (found._submitted_by && Array.isArray(found._submitted_by.$in)) {
    return found._submitted_by.$in;
  }

  return undefined;
}

/**
 * Detect if permission has partial permissions and "by users" filter in
 * at least one of them.
 */
export function hasPartialByUsers(perm: PermissionResponse) {
  return Boolean(
    'partial_permissions' in perm &&
      perm.partial_permissions?.some((partialPerm) =>
        Boolean(getPartialByUsersFilterList(partialPerm))
      )
  );
}

/** Detects if given filter is of "by responses" kind. */
export function isPartialByResponsesFilter(filter: PartialPermissionFilter) {
  const filterKeys = Object.keys(filter);
  // We are looking for an object that has some props other thane the one for
  // "by users" filter (at least one other)
  return filterKeys.some((key) => key !== '_submitted_by');
}

/**
 * Finds "by responses" filter inside the partial permission. Note that if given
 * filter includes both "by responses" and "by users" properties, we will omit
 * `_submitted_by` in returned object.
 */
export function getPartialByResponsesFilter(
  partialPerm: PartialPermission
): PartialPermissionFilterByResponses | undefined {
  let found: PartialPermissionFilterByResponses | undefined;
  partialPerm.filters.forEach((filter) => {
    if (isPartialByResponsesFilter(filter)) {
      // We cast the type, because we checked with `isPartialByResponsesFilter`
      found = filter as PartialPermissionFilterByResponses;
    }
  });

  if (found) {
    const foundClone = clonedeep(found);
    // Remove `_submitted_by`, leave "by responses" stuff (at current point
    // in time we leave everything else)
    delete foundClone._submitted_by;
    return foundClone;
  }

  return undefined;
}

/**
 * Detect if permission has partial permissions and "by users" filter in
 * at least one of them.
 */
export function hasPartialByResponses(perm: PermissionResponse) {
  return Boolean(
    'partial_permissions' in perm &&
      perm.partial_permissions?.some((partialPerm) =>
        Boolean(getPartialByResponsesFilter(partialPerm))
      )
  );
}

/**
 * Checks if logged in user has given permission in context of a submission.
 *
 * This implementation does not use the Back End, but tries to replicate the
 * rules. So far, the Front End only supports two filters.
 */
export function userHasPermForSubmission(
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
  // This would be a case of stored permissions and configuration mismatch
  if (!partialPerm) {
    return false;
  }

  const byUsersFilterList = getPartialByUsersFilterList(partialPerm);
  const byResponsesFilter = getPartialByResponsesFilter(partialPerm);

  // It is possible that given permission will have both filters, so we need to
  // check both of them at the end of this. We start with `true` so that if
  // there is no filter, it will pass through.
  let thisUserCanWithByUsersFilter = true;
  let thisUserCanWithByResponsesFilter = true;

  if (byUsersFilterList) {
    const submittedByUsername = submission._submitted_by;
    // If the `_submitted_by` was not stored, there is no way of knowing.
    if (submittedByUsername === null) {
      return false;
    }
    // Check if given username is inside the allowed usernames list (`byUsersFilterList`)
    thisUserCanWithByUsersFilter =
      byUsersFilterList.includes(submittedByUsername);
  }

  if (byResponsesFilter) {
    // TODO see if this is question name or path (i.e. if it works with grouped
    // questions)

    // There can be only one
    const questionPath = Object.keys(byResponsesFilter)[0];
    if (!questionPath) {
      return false;
    }
    // Get the filter value
    const allowedResponse = byResponsesFilter[questionPath];
    if (!allowedResponse) {
      return false;
    }

    // Check if response in the submission data matches the allowed response
    // the filter
    thisUserCanWithByResponsesFilter =
      questionPath in submission &&
      submission[questionPath] === allowedResponse;
  }

  return thisUserCanWithByUsersFilter && thisUserCanWithByResponsesFilter;
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
 * Returns a human readable permission label, has to do some juggling for
 * partial permissions. Fallback is permission codename.
 */
export function getPermLabel(perm: PermissionResponse) {
  // For partial permissions we return a general label that matches all possible
  // partial permissions (i.e. same label for "View submissions only from
  // specific users" and "Edit submissions only from specific users" etc.). With
  // current available kinds of partial permissions we return one of three
  // labels: "A", "B" or "A and B"
  const hasByUsers = hasPartialByUsers(perm);
  const hasByResponses = hasPartialByResponses(perm);
  if (hasByUsers && hasByResponses) {
    return PARTIAL_BY_MULTIPLE_LABEL;
  } else if (hasByUsers) {
    return PARTIAL_BY_USERS_LABEL;
  } else if (hasByResponses) {
    return PARTIAL_BY_RESPONSES_LABEL;
  }

  // Get permission definition
  const permDef = permConfig.getPermission(perm.permission);

  if (permDef) {
    const checkboxName = getCheckboxNameByPermission(permDef.codename);

    if (checkboxName) {
      return CHECKBOX_LABELS[checkboxName];
    }
  }

  // If we couldn't get the definition, we will display "???", so it's clear
  // something is terribly wrong. But this case is ~impossible to get, and we
  // mostly have it for TS reasons.
  return '???';
}

/**
 * Displays a bit more user friendly name (than `getPermLabel`) of given
 * permission. For partial "by users" permission it will include the list of
 * users (limited by `maxParentheticalUsernames`) in the name (we could go
 * simpler, but we want to keep existing functionality). For partial
 * "by responses" permission it will just return the label (simplicity). And if
 * it happens given permission is both "by users" and "by responses" we return
 * combined name.
 */
export function getFriendlyPermName(
  perm: PermissionResponse,
  maxParentheticalUsernames = 3
) {
  const permLabel = getPermLabel(perm);

  const hasByUsers = hasPartialByUsers(perm);
  const hasByResponses = hasPartialByResponses(perm);
  if (hasByUsers && hasByResponses) {
    return `${getByUsersFriendlyPermName(
      perm,
      maxParentheticalUsernames
    )}, ${PARTIAL_BY_RESPONSES_LABEL}`;
  } else if (hasByUsers) {
    return getByUsersFriendlyPermName(perm, maxParentheticalUsernames);
  } else if (hasByResponses) {
    return PARTIAL_BY_RESPONSES_LABEL;
  }

  // In all other scenarios we return the same thing as `getPermLabel`.
  return permLabel;
}

function getByUsersFriendlyPermName(
  perm: PermissionResponse,
  maxParentheticalUsernames = 3
) {
  let permUsers: string[] = [];

  if (perm.partial_permissions) {
    perm.partial_permissions.forEach((partial) => {
      const byUsersFilterList = getPartialByUsersFilterList(partial);
      if (byUsersFilterList) {
        permUsers = permUsers.concat(byUsersFilterList);
      }
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
    .replace('##permission_label##', PARTIAL_BY_USERS_LABEL)
    .replace(
      '##username_list##',
      permUsers.slice(0, maxParentheticalUsernames).join(', ')
    )
    .replace(
      '##hidden_username_count##',
      String(permUsers.length - maxParentheticalUsernames)
    );
}
