// TODO: In future please consider moving some things from `js/dataInterface`.

import {createEnum} from 'js/constants';

export type PermissionCodename =
  | 'add_submissions'
  | 'change_asset'
  | 'change_metadata_asset'
  | 'change_submissions'
  | 'delete_submissions'
  | 'discover_asset'
  | 'manage_asset'
  | 'partial_submissions'
  | 'validate_submissions'
  | 'view_asset'
  | 'view_submissions';

/**
 * BAD CODE™ A hardcoded list of permissions codenames.
 *
 * All of them are really defined on backend, and we get them through the
 * permissions config endpoint, but as we need these names to reference them in
 * the code to build the UI it's a necessary evil.
 *
 * NOTE: to know what these permissions permit see `kpi/permissions.py` file,
 * where you have to match the classes with endpoints and their HTTP methods.
 */
type PermissionsCodenames = {[P in PermissionCodename]: PermissionCodename};
export const PERMISSIONS_CODENAMES: PermissionsCodenames = {
  // Is user able to view asset - mostly handled by Backend just not returning
  // asset in the results or direct endpoint.
  view_asset: 'view_asset',

  // Is user able to edit asset, i.e. to change anything in the asset endpoint,
  // so: editing in Form Builder, changing tags, changing settings, replace XLS,
  // change translations, move between collection, archive, unarchive, delete…
  change_asset: 'change_asset',

  // Is asset discoverable in public lists.
  discover_asset: 'discover_asset',

  // Is user able to manage some aspects of asset (it is different from editing)
  // such as: saving export settings, sharing asset (in future)…
  manage_asset: 'manage_asset',

  // Is user able to add submissions - handled by Backend submissions endpoint.
  add_submissions: 'add_submissions',

  // Is user able to see submissions, i.e. the Table View.
  view_submissions: 'view_submissions',

  // Used for partially permissing user actions on submissions.
  partial_submissions: 'partial_submissions',

  // Is user able to edit existing submissions.
  change_submissions: 'change_submissions',

  // Is user able to delete submissions.
  delete_submissions: 'delete_submissions',

  // Is user able to change the validation status of submissions.
  validate_submissions: 'validate_submissions',

  change_metadata_asset: 'change_metadata_asset',
};

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
