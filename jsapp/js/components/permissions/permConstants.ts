// TODO: In future please move `PermissionCodename` and `PERMISSIONS_CODENAMES`
// from `js/constants` into this file. Also consider moving some things from
// `js/dataInterface`.

import {createEnum} from 'js/constants';
import type {PermissionCodename} from 'js/constants';

/**
 * Hi! Sorry for these checkboxes related types and enums being so complex, but
 * I feel it's necessary, if we want to avoid hard to debug bugs. These all are
 * used in files connected to the sharingForm modal. I will describe each of
 * these constants in a detail to not cause confusion by a future reader.
 */

/** Checkboxes for non-partial permissions. */
type CheckboxNameRegular =
  | 'formView'
  | 'formEdit'
  | 'formManage'
  | 'submissionsAdd'
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
export type CheckboxNameAll = CheckboxNameRegular | CheckboxNamePartial;
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
 * This is a map of pairs that connects a partial checkbox to a permission.
 *
 * NOTE: a partial checkbox is using a "partial_submissions" permission, but
 * in the array of de facto permissions it is using these ones.
 */
export const PARTIAL_PERM_PAIRS: {
  [key in CheckboxNamePartial]: PermissionCodename;
} = {
  submissionsViewPartial: 'view_submissions',
  submissionsEditPartial: 'change_submissions',
  submissionsValidatePartial: 'validate_submissions',
  submissionsDeletePartial: 'delete_submissions',
};
Object.freeze(PARTIAL_PERM_PAIRS);

/**
 * This is a map of pairs that connect a checkbox to a permission.
 */
export const CHECKBOX_PERM_PAIRS: {
  [key in CheckboxNameAll]: PermissionCodename;
} = {
  formView: 'view_asset',
  formEdit: 'change_asset',
  formManage: 'manage_asset',
  submissionsAdd: 'add_submissions',
  submissionsView: 'view_submissions',
  submissionsViewPartial: 'partial_submissions',
  submissionsEdit: 'change_submissions',
  submissionsEditPartial: 'partial_submissions',
  submissionsValidate: 'validate_submissions',
  submissionsValidatePartial: 'partial_submissions',
  submissionsDelete: 'delete_submissions',
  submissionsDeletePartial: 'partial_submissions',
};
Object.freeze(CHECKBOX_PERM_PAIRS);

/**
 * This is a map to handle exceptions for partial submissions which imply
 * a regular permission
 */
export const PARTIAL_IMPLIED_CHECKBOX_PAIRS = {
  [CHECKBOX_NAMES.submissionsEditPartial]: CHECKBOX_NAMES.submissionsAdd,
};
Object.freeze(PARTIAL_IMPLIED_CHECKBOX_PAIRS);
