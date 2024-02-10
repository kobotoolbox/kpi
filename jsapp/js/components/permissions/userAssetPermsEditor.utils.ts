import clonedeep from 'lodash.clonedeep';
import type {PermsFormData} from './permParser';
import permConfig from './permConfig';
import {
  PARTIAL_BY_USERS_PERM_PAIRS,
  PARTIAL_BY_RESPONSES_PERM_PAIRS,
  CHECKBOX_NAMES,
  CHECKBOX_PERM_PAIRS,
  PARTIAL_IMPLIED_CHECKBOX_PAIRS,
  CHECKBOX_DISABLED_SUFFIX,
} from './permConstants';
import type {
  CheckboxNameAll,
  CheckboxNamePartialByUsers,
  CheckboxNamePartialByResponses,
  PermissionCodename,
} from './permConstants';
import type {AssignablePermsMap} from './sharingForm.component';
import {
  getPartialByUsersListName,
  getPartialByResponsesQuestionName,
  getPartialByResponsesValueName,
} from './utils';
import type {UserAssetPermsEditorState} from './userAssetPermsEditor.component';

/**
 * Returns a list of checkboxes that applies for given permission. Because
 * `partial_submissions` permission applies to a range of permissions (thus to
 * multiple checkboxes) this function returns a list of items instead of
 * a single checkbox name.
 */
function getPermissionCheckboxPairs(permCodename: PermissionCodename) {
  const found: CheckboxNameAll[] = [];

  for (const [checkboxName, checkboxPermPair] of Object.entries(
    CHECKBOX_PERM_PAIRS
  )) {
    if (checkboxPermPair === permCodename) {
      found.push(checkboxName as CheckboxNameAll);
    }
  }

  return found;
}

/**
 * For given checkbox (permission) uses permissions config to fix all implied
 * and contradictory checkboxes (permissions).
 *
 * Returns updated state object
 */
function applyValidityRulesForCheckbox(
  checkboxName: CheckboxNameAll,
  stateObj: UserAssetPermsEditorState
) {
  let output = clonedeep(stateObj);

  // Step 1: Only apply the rules for checked checkboxes
  if (output[checkboxName] === false) {
    return output;
  }

  // Step 2: Get implied and contradictory perms from definition
  const permDef = permConfig.getPermissionByCodename(
    CHECKBOX_PERM_PAIRS[checkboxName]
  );
  const impliedPerms = permDef?.implied || [];
  const contradictoryPerms = permDef?.contradictory || [];

  // Step 3: All implied will be checked and disabled
  impliedPerms.forEach((permUrl) => {
    const impliedPermDef = permConfig.getPermission(permUrl);
    if (!impliedPermDef) {
      return;
    }

    let impliedCheckboxes = getPermissionCheckboxPairs(impliedPermDef.codename);
    if (checkboxName in PARTIAL_IMPLIED_CHECKBOX_PAIRS) {
      impliedCheckboxes = impliedCheckboxes.concat(
        PARTIAL_IMPLIED_CHECKBOX_PAIRS[checkboxName]
      );
    }

    impliedCheckboxes.forEach((impliedCheckbox) => {
      output = Object.assign(output, {
        [impliedCheckbox]: true,
        [impliedCheckbox + CHECKBOX_DISABLED_SUFFIX]: true,
      });
    });
  });

  // Step 4: All contradictory will be unchecked and disabled
  contradictoryPerms.forEach((permUrl) => {
    const contradictoryPermDef = permConfig.getPermission(permUrl);
    if (!contradictoryPermDef) {
      return;
    }

    const contradictoryCheckboxes = getPermissionCheckboxPairs(
      contradictoryPermDef.codename
    );
    contradictoryCheckboxes.forEach((contradictoryCheckbox) => {
      output = Object.assign(output, {
        [contradictoryCheckbox]: false,
        [contradictoryCheckbox + CHECKBOX_DISABLED_SUFFIX]: true,
      });
    });
  });

  return output;
}

/**
 * Helps to avoid users submitting invalid data.
 *
 * Checking some of the checkboxes implies that other are also checked
 * and can't be unchecked.
 *
 * Checking some of the checkboxes implies that other can't be checked.
 *
 * Returns updated state object
 */
export function applyValidityRules(stateObj: UserAssetPermsEditorState) {
  // Step 1: Avoid mutation
  let output = clonedeep(stateObj);

  // Step 2: Enable all checkboxes (make them not disabled) before applying
  // the rules
  for (const [, checkboxName] of Object.entries(CHECKBOX_NAMES)) {
    output = Object.assign(output, {
      [checkboxName + CHECKBOX_DISABLED_SUFFIX]: false,
    });
  }

  // Step 3: Apply permissions configuration rules to checkboxes
  for (const [, checkboxName] of Object.entries(CHECKBOX_NAMES)) {
    output = applyValidityRulesForCheckbox(checkboxName, output);
  }

  // Step 4: For each unchecked partial checkbox, clean up the data of related
  // properties
  for (const [, checkboxName] of Object.entries(CHECKBOX_NAMES)) {
    if (
      checkboxName in PARTIAL_BY_USERS_PERM_PAIRS &&
      output[checkboxName] === false
    ) {
      const byUsersCheckboxName = checkboxName as CheckboxNamePartialByUsers;
      const listName = getPartialByUsersListName(byUsersCheckboxName);
      // Cleanup the list of users
      output = Object.assign(output, {[listName]: []});
    }

    if (
      checkboxName in PARTIAL_BY_RESPONSES_PERM_PAIRS &&
      output[checkboxName] === false
    ) {
      const byResponsesCheckboxName =
        checkboxName as CheckboxNamePartialByResponses;
      const questionName = getPartialByResponsesQuestionName(
        byResponsesCheckboxName
      );
      const valueName = getPartialByResponsesValueName(byResponsesCheckboxName);
      // Cleanup the question and value
      output = Object.assign(output, {[questionName]: null, [valueName]: ''});
    }
  }

  return output;
}

export function isAssignable(
  permCodename: PermissionCodename,
  assignablePerms: AssignablePermsMap
) {
  const permDef = permConfig.getPermissionByCodename(permCodename);
  if (!permDef) {
    return false;
  } else {
    return assignablePerms.has(permDef.url);
  }
}

/**
 * The list of users for …PartialByUsers checkbox can't be empty if
 * the checkbox is checked
 */
export function isPartialByUsersValid(
  partialCheckboxName: CheckboxNamePartialByUsers,
  stateObj: UserAssetPermsEditorState
) {
  // If partial checkbox is checked, we require the users list to not be empty
  if (stateObj[partialCheckboxName] === true) {
    return (
      stateObj[getPartialByUsersListName(partialCheckboxName)].length !== 0
    );
  }
  return true;
}

export function isPartialByResponsesValid(
  partialCheckboxName: CheckboxNamePartialByResponses,
  stateObj: UserAssetPermsEditorState
) {
  // If partial checkbox is checked, we require the question to be present, and
  // we don't check the value, as we allow empty string (meaning no response to
  // the question)
  if (stateObj[partialCheckboxName] === true) {
    return Boolean(
      stateObj[getPartialByResponsesQuestionName(partialCheckboxName)]
    );
  }
  return true;
}

/**
 * Returns only the properties for assignable permissions
 */
export function getFormData(
  stateObj: UserAssetPermsEditorState,
  assignablePerms: AssignablePermsMap
): PermsFormData {
  const output: PermsFormData = {
    // We always include username
    username: stateObj.username,
  };

  // We loop through all of the checkboxes to see if the permission paired to
  // it is assignable
  for (const [, checkboxName] of Object.entries(CHECKBOX_NAMES)) {
    if (isAssignable(CHECKBOX_PERM_PAIRS[checkboxName], assignablePerms)) {
      // Add current form data to output
      output[checkboxName] = stateObj[checkboxName];

      if (checkboxName in PARTIAL_BY_USERS_PERM_PAIRS) {
        // We cast it here, because we ensure it's partial "by users" with
        // the above function
        const listName = getPartialByUsersListName(
          checkboxName as CheckboxNamePartialByUsers
        );
        output[listName] = stateObj[listName];
      }

      if (checkboxName in PARTIAL_BY_RESPONSES_PERM_PAIRS) {
        // We cast it here, because we ensure it's partial "by responses" with
        // the above function
        const questionName = getPartialByResponsesQuestionName(
          checkboxName as CheckboxNamePartialByResponses
        );
        const valueName = getPartialByResponsesValueName(
          checkboxName as CheckboxNamePartialByResponses
        );
        output[questionName] = stateObj[questionName] || '';
        output[valueName] = stateObj[valueName];
      }
    }
  }

  return output;
}
