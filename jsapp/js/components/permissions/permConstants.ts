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
  | 'delete_asset'
  | 'view_asset'
  | 'view_submissions';

/**
 * A hardcoded list of permissions codenames.
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

  // TODO: describe this (relatively) new permission
  delete_asset: 'delete_asset',

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

/** Names of checkboxes for non-partial permissions. */
type CheckboxNameRegular =
  | 'formView'
  | 'formEdit'
  | 'formManage'
  | 'submissionsAdd'
  | 'submissionsView'
  | 'submissionsEdit'
  | 'submissionsValidate'
  | 'submissionsDelete';
/** Names of checkboxes for "by users" partial permissions. */
export type CheckboxNamePartialByUsers =
  | 'submissionsViewPartialByUsers'
  | 'submissionsEditPartialByUsers'
  | 'submissionsValidatePartialByUsers'
  | 'submissionsDeletePartialByUsers';
/** Names of checkboxes for "by responses" partial permissions. */
export type CheckboxNamePartialByResponses =
  | 'submissionsViewPartialByResponses'
  | 'submissionsEditPartialByResponses'
  | 'submissionsValidatePartialByResponses'
  | 'submissionsDeletePartialByResponses';
/** All checkboxes names combined. */
export type CheckboxNameAll =
  | CheckboxNameRegular
  | CheckboxNamePartialByUsers
  | CheckboxNamePartialByResponses;

/** Name of lists of usernames for "by users" partial permissions checkboxes. */
export type PartialByUsersListName =
  | 'submissionsViewPartialByUsersList'
  | 'submissionsEditPartialByUsersList'
  | 'submissionsDeletePartialByUsersList'
  | 'submissionsValidatePartialByUsersList';

/**
 * Name of select used by user to choose question for "by responses" partial
 * permissions checkboxes.
 */
export type PartialByResponsesQuestionName =
  | 'submissionsViewPartialByResponsesQuestion'
  | 'submissionsEditPartialByResponsesQuestion'
  | 'submissionsDeletePartialByResponsesQuestion'
  | 'submissionsValidatePartialByResponsesQuestion';
/**
 * Name of textbox used by user to type the condition value for "by responses"
 * partial permissions checkboxes.
 */
export type PartialByResponsesValueName =
  | 'submissionsViewPartialByResponsesValue'
  | 'submissionsEditPartialByResponsesValue'
  | 'submissionsDeletePartialByResponsesValue'
  | 'submissionsValidatePartialByResponsesValue';

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
  'submissionsViewPartialByUsers',
  'submissionsViewPartialByResponses',
  'submissionsEdit',
  'submissionsEditPartialByUsers',
  'submissionsEditPartialByResponses',
  'submissionsValidate',
  'submissionsValidatePartialByUsers',
  'submissionsValidatePartialByResponses',
  'submissionsDelete',
  'submissionsDeletePartialByUsers',
  'submissionsDeletePartialByResponses',
]) as {[P in CheckboxNameAll]: CheckboxNameAll};
Object.freeze(CHECKBOX_NAMES);

/**
 * This is a map of pairs that connects a partial "by users" checkbox to
 * a matching permission.
 *
 * NOTE: a partial checkbox is using a "partial_submissions" permission, but
 * in the array of de facto permissions it is using these ones. So for example
 * imagine it being something like this: we give a partial_submissions
 * permission to Joe, and inside of this permission we define a list of users,
 * and a view_submissions permission - meaning that "Joe can view submissions,
 * but only for this limited list of users".
 */
export const PARTIAL_BY_USERS_PERM_PAIRS: {
  [key in CheckboxNamePartialByUsers]: PermissionCodename;
} = {
  submissionsViewPartialByUsers: 'view_submissions',
  submissionsEditPartialByUsers: 'change_submissions',
  submissionsValidatePartialByUsers: 'validate_submissions',
  submissionsDeletePartialByUsers: 'delete_submissions',
};
Object.freeze(PARTIAL_BY_USERS_PERM_PAIRS);

/**
 * This is a map of pairs that connects a partial "by responses" checkbox to
 * a matching permission.
 */
export const PARTIAL_BY_RESPONSES_PERM_PAIRS: {
  [key in CheckboxNamePartialByResponses]: PermissionCodename;
} = {
  submissionsViewPartialByResponses: 'view_submissions',
  submissionsEditPartialByResponses: 'change_submissions',
  submissionsValidatePartialByResponses: 'validate_submissions',
  submissionsDeletePartialByResponses: 'delete_submissions',
};
Object.freeze(PARTIAL_BY_RESPONSES_PERM_PAIRS);

/**
 * This is a map of pairs that connect a checkbox name to a permission name.
 */
export const CHECKBOX_PERM_PAIRS: {
  [key in CheckboxNameAll]: PermissionCodename;
} = {
  formView: 'view_asset',
  formEdit: 'change_asset',
  formManage: 'manage_asset',
  submissionsAdd: 'add_submissions',
  submissionsView: 'view_submissions',
  submissionsViewPartialByUsers: 'partial_submissions',
  submissionsViewPartialByResponses: 'partial_submissions',
  submissionsEdit: 'change_submissions',
  submissionsEditPartialByUsers: 'partial_submissions',
  submissionsEditPartialByResponses: 'partial_submissions',
  submissionsValidate: 'validate_submissions',
  submissionsValidatePartialByUsers: 'partial_submissions',
  submissionsValidatePartialByResponses: 'partial_submissions',
  submissionsDelete: 'delete_submissions',
  submissionsDeletePartialByUsers: 'partial_submissions',
  submissionsDeletePartialByResponses: 'partial_submissions',
};
Object.freeze(CHECKBOX_PERM_PAIRS);

/**
 * This is a map to handle exceptions for partial submissions which imply
 * a regular permission
 */
export const PARTIAL_IMPLIED_CHECKBOX_PAIRS = {
  [CHECKBOX_NAMES.submissionsEditPartialByUsers]: CHECKBOX_NAMES.submissionsAdd,
  [CHECKBOX_NAMES.submissionsEditPartialByResponses]:
    CHECKBOX_NAMES.submissionsAdd,
};
Object.freeze(PARTIAL_IMPLIED_CHECKBOX_PAIRS);

/**
 * Most of these labels are also available from `api/v2/assets/<uid>/` endpoint
 * in the `assignable_permissions` property. Unfortunately due to how the data
 * is architectured, the labels for partial permissions are not going to be
 * available for multiple types.
 */
export const CHECKBOX_LABELS: {[key in CheckboxNameAll]: string} = {
  formView: t('View form'),
  formEdit: t('Edit form'),
  formManage: t('Manage project'),
  submissionsAdd: t('Add submissions'),
  submissionsView: t('View submissions'),
  submissionsViewPartialByUsers: t('View submissions only from specific users'),
  submissionsViewPartialByResponses: t('View submissions based on a condition'),
  submissionsEdit: t('Edit submissions'),
  submissionsEditPartialByUsers: t('Edit submissions only from specific users'),
  submissionsEditPartialByResponses: t('Edit submissions based on a condition'),
  submissionsValidate: t('Validate submissions'),
  submissionsValidatePartialByUsers: t(
    'Validate submissions only from specific users'
  ),
  submissionsValidatePartialByResponses: t(
    'Validate submissions based on a condition'
  ),
  submissionsDelete: t('Delete submissions'),
  submissionsDeletePartialByUsers: t(
    'Delete submissions only from specific users'
  ),
  submissionsDeletePartialByResponses: t(
    'Delete submissions based on a condition'
  ),
};
Object.freeze(CHECKBOX_LABELS);

export const PARTIAL_BY_USERS_LABEL = t(
  'Act on submissions only from specific users'
);

export const PARTIAL_BY_RESPONSES_LABEL = t(
  'Act on submissions based on a condition'
);

// To be used when there are multiple filters in single permission - e.g. it has
// both "by users" and "by responses" defined.
export const PARTIAL_BY_MULTIPLE_LABEL = t(
  'Act on submissions based on multiple conditions'
);

export const CHECKBOX_DISABLED_SUFFIX = 'Disabled';
