/**
 * Hi! Sorry for this being so complex, but I feel it's necessary, if we want to
 * avoid hard to debug bugs. These all are used in files connected to the
 * sharingForm modal. I will describe each of these constants in a detail to not
 * cause confusion by a future reader.
 */

import {createEnum, PERMISSIONS_CODENAMES} from 'js/constants';
import type {PermissionCodename} from 'js/constants';

/**
 * These two are the text added to a checkbox name to signify a paired property.
 * E.g for "formView" you will get "formViewPartial" and "formViewPartialUsers"
 */
export const SUFFIX_PARTIAL = 'Partial';
// `SUFFIX_USERS` should be always added to a Partial one
export const SUFFIX_USERS = 'Users';

/** Checkboxes for non-partial permissions that have no partial counterpart. */
type CheckboxNameRegularSingle =
  | 'formView'
  | 'formEdit'
  | 'formManage'
  | 'submissionsAdd';
/** Checkboxes for non-partial permissions that have partial counterpart. */
export type CheckboxNameRegularPair =
  | 'submissionsView'
  | 'submissionsEdit'
  | 'submissionsValidate'
  | 'submissionsDelete';
/** Checkboxes for partial permissions (the counterparts). */
export type CheckboxNamePartial =
  | 'submissionsViewPartial'
  | 'submissionsEditPartial'
  | 'submissionsValidatePartial'
  | 'submissionsDeletePartial';
/** All checkboxes combined. */
export type CheckboxNameAll =
  | CheckboxNameRegularSingle
  | CheckboxNameRegularPair
  | CheckboxNamePartial;
/** List of usernames for a partial permission checkbox. */
export type CheckboxNameListPartial =
  | 'submissionsViewPartialUsers'
  | 'submissionsEditPartialUsers'
  | 'submissionsDeletePartialUsers'
  | 'submissionsValidatePartialUsers';

/**
 * This list contains the names of all the checkboxes in userAssetPermsEditor.
 * Every one of them is strictly connected to a permission, see the pairs at
 * CHECKBOX_PERM_PAIRS below.
 */
export const CHECKBOX_NAMES = createEnum([
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
]) as {[P in CheckboxNameAll]: CheckboxNameAll};
Object.freeze(CHECKBOX_NAMES);

/**
 * This is a map of pairs that connects a general checkbox to a partial checkbox.
 */
export const PARTIAL_CHECKBOX_PAIRS: {
  [key in CheckboxNameRegularPair]: CheckboxNamePartial;
} = {
  submissionsView: 'submissionsViewPartial',
  submissionsEdit: 'submissionsEditPartial',
  submissionsValidate: 'submissionsValidatePartial',
  submissionsDelete: 'submissionsDeletePartial',
};
Object.freeze(PARTIAL_CHECKBOX_PAIRS);

/**
 * This is a map of pairs that connects a partial checkbox to a permission.
 *
 * NOTE: a partial checkbox is using a "partial_submissions" permission, but
 * in the array of de facto permissions it is using these ones.
 */
export const PARTIAL_PERM_PAIRS: {
  [key in CheckboxNamePartial]: PermissionCodename;
} = {
  submissionsViewPartial: PERMISSIONS_CODENAMES.view_submissions,
  submissionsEditPartial: PERMISSIONS_CODENAMES.change_submissions,
  submissionsValidatePartial: PERMISSIONS_CODENAMES.validate_submissions,
  submissionsDeletePartial: PERMISSIONS_CODENAMES.delete_submissions,
};
Object.freeze(PARTIAL_PERM_PAIRS);

/**
 * This is a map of pairs that connect a checkbox to a permission.
 */
export const CHECKBOX_PERM_PAIRS: {
  [key in CheckboxNameAll]: PermissionCodename;
} = {
  formView: PERMISSIONS_CODENAMES.view_asset,
  formEdit: PERMISSIONS_CODENAMES.change_asset,
  formManage: PERMISSIONS_CODENAMES.manage_asset,
  submissionsAdd: PERMISSIONS_CODENAMES.add_submissions,
  submissionsView: PERMISSIONS_CODENAMES.view_submissions,
  submissionsViewPartial: PERMISSIONS_CODENAMES.partial_submissions,
  submissionsEdit: PERMISSIONS_CODENAMES.change_submissions,
  submissionsEditPartial: PERMISSIONS_CODENAMES.partial_submissions,
  submissionsValidate: PERMISSIONS_CODENAMES.validate_submissions,
  submissionsValidatePartial: PERMISSIONS_CODENAMES.partial_submissions,
  submissionsDelete: PERMISSIONS_CODENAMES.delete_submissions,
  submissionsDeletePartial: PERMISSIONS_CODENAMES.partial_submissions,
};
Object.freeze(CHECKBOX_PERM_PAIRS);

/**
 * This is a map that mirrors the CHECKBOX_PERM_PAIRS,
 * so it pairs a permission codename to a checkbox name
 */
export const PERM_CHECKBOX_PAIRS = Object.fromEntries(
  Object.entries(CHECKBOX_PERM_PAIRS).map((a) => a.reverse())
);

/**
 * This is a map to handle exceptions for partial submissions which imply
 * a regular permission
 */
export const PARTIAL_IMPLIED_CHECKBOX_PAIRS = {
  [CHECKBOX_NAMES.submissionsEditPartial]: CHECKBOX_NAMES.submissionsAdd,
};
Object.freeze(PARTIAL_IMPLIED_CHECKBOX_PAIRS);
