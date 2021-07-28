/**
 * Hi! Sorry for this being so complex, but I feel it's necessary, if we want to
 * avoid hard to debug bugs. These all are used in files connected to the
 * sharingForm modal. I will describe each of these constants in a detail to not
 * cause confusion by a future reader.
 */

import {PERMISSIONS_CODENAMES} from 'js/constants';

/**
 * These two are the text added to a checkbox name to signify a paired property.
 * E.g for "formView" you will get "formViewPartial" and "formViewPartialUsers"
 */
export const SUFFIX_PARTIAL = 'Partial';
export const SUFFIX_USERS = 'Users'; // should be always added to a Partial one

/**
 * This list contains the names of all the checkboxes in userAssetPermsEditor.
 * Every one of them is strictly connected to a permission, see the pairs at
 * CHECKBOX_PERM_PAIRS below.
 */
export const CHECKBOX_NAMES = {};
new Set([
  'formView',
  'formEdit',
  'formManage',
  'submissionsAdd',
  'submissionsView',
  'submissionsViewPartial',
  'submissionsEdit',
  'submissionsEditPartial',
  'submissionsValidate',
  'submissionsValidatePartial',
  'submissionsDelete',
  'submissionsDeletePartial',
]).forEach((name) => {CHECKBOX_NAMES[name] = name;});
Object.freeze(CHECKBOX_NAMES);

/**
 * This is a map of pairs that connects a general checkbox to a partial checkbox.
 */
export const PARTIAL_CHECKBOX_PAIRS = {};
PARTIAL_CHECKBOX_PAIRS[CHECKBOX_NAMES.submissionsView] = CHECKBOX_NAMES.submissionsViewPartial;
PARTIAL_CHECKBOX_PAIRS[CHECKBOX_NAMES.submissionsEdit] = CHECKBOX_NAMES.submissionsEditPartial;
PARTIAL_CHECKBOX_PAIRS[CHECKBOX_NAMES.submissionsValidate] = CHECKBOX_NAMES.submissionsValidatePartial;
PARTIAL_CHECKBOX_PAIRS[CHECKBOX_NAMES.submissionsDelete] = CHECKBOX_NAMES.submissionsDeletePartial;
Object.freeze(PARTIAL_CHECKBOX_PAIRS);

/**
 * This is a map of pairs that connects a partial checkbox to a permission.
 *
 * NOTE: a partial checkbox is using a "partial_submissions" permission, but
 * in the array of de facto permissions it is using these ones.
 */
export const PARTIAL_PERM_PAIRS = {};
PARTIAL_PERM_PAIRS[CHECKBOX_NAMES.submissionsViewPartial] = PERMISSIONS_CODENAMES.view_submissions;
PARTIAL_PERM_PAIRS[CHECKBOX_NAMES.submissionsEditPartial] = PERMISSIONS_CODENAMES.change_submissions;
PARTIAL_PERM_PAIRS[CHECKBOX_NAMES.submissionsValidatePartial] = PERMISSIONS_CODENAMES.validate_submissions;
PARTIAL_PERM_PAIRS[CHECKBOX_NAMES.submissionsDeletePartial] = PERMISSIONS_CODENAMES.delete_submissions;
Object.freeze(PARTIAL_PERM_PAIRS);

/**
 * This is a map of pairs that connect a checkbox to a permission.
 */
export const CHECKBOX_PERM_PAIRS = {};
CHECKBOX_PERM_PAIRS[CHECKBOX_NAMES.formView] = PERMISSIONS_CODENAMES.view_asset;
CHECKBOX_PERM_PAIRS[CHECKBOX_NAMES.formEdit] = PERMISSIONS_CODENAMES.change_asset;
CHECKBOX_PERM_PAIRS[CHECKBOX_NAMES.formManage] = PERMISSIONS_CODENAMES.manage_asset;
CHECKBOX_PERM_PAIRS[CHECKBOX_NAMES.submissionsAdd] = PERMISSIONS_CODENAMES.add_submissions;
CHECKBOX_PERM_PAIRS[CHECKBOX_NAMES.submissionsView] = PERMISSIONS_CODENAMES.view_submissions;
CHECKBOX_PERM_PAIRS[CHECKBOX_NAMES.submissionsViewPartial] = PERMISSIONS_CODENAMES.partial_submissions;
CHECKBOX_PERM_PAIRS[CHECKBOX_NAMES.submissionsEdit] = PERMISSIONS_CODENAMES.change_submissions;
CHECKBOX_PERM_PAIRS[CHECKBOX_NAMES.submissionsEditPartial] = PERMISSIONS_CODENAMES.partial_submissions;
CHECKBOX_PERM_PAIRS[CHECKBOX_NAMES.submissionsValidate] = PERMISSIONS_CODENAMES.validate_submissions;
CHECKBOX_PERM_PAIRS[CHECKBOX_NAMES.submissionsValidatePartial] = PERMISSIONS_CODENAMES.partial_submissions;
CHECKBOX_PERM_PAIRS[CHECKBOX_NAMES.submissionsDelete] = PERMISSIONS_CODENAMES.delete_submissions;
CHECKBOX_PERM_PAIRS[CHECKBOX_NAMES.submissionsDeletePartial] = PERMISSIONS_CODENAMES.partial_submissions;
Object.freeze(CHECKBOX_PERM_PAIRS);

/**
 * This is a map that mirrors the CHECKBOX_PERM_PAIRS,
 * so it pairs a permission codename (No partial though!) to a checkbox name
 */
export const PERM_CHECKBOX_PAIRS = {};
Object.keys(PARTIAL_CHECKBOX_PAIRS).forEach((checkboxName) => {
  PERM_CHECKBOX_PAIRS[CHECKBOX_PERM_PAIRS[checkboxName]] = checkboxName;
});
Object.freeze(PERM_CHECKBOX_PAIRS);

/**
 * This is a map to handle exceptions for partial submissions which imply
 * a regular permission
 */
export const PARTIAL_IMPLIED_CHECKBOX_PAIRS = {};
PARTIAL_IMPLIED_CHECKBOX_PAIRS[CHECKBOX_NAMES.submissionsEditPartial] = [
  CHECKBOX_NAMES.submissionsAdd,
];
Object.freeze(PARTIAL_IMPLIED_CHECKBOX_PAIRS);
