export interface AssetLockingProfileDefinition {
  name: string;
  restrictions: LockingRestrictionName[];
}

export interface IndexedAssetLockingProfileDefinition extends AssetLockingProfileDefinition {
  index: number;
}

/**
 * When adding or changing restrictions, plase make sure to update all the
 * arrays of restrictions below.
 *
 * NOTE: this list should match a list from:
 * https://github.com/kobotoolbox/formpack/blob/master/src/formpack/constants.py
 */
export enum LockingRestrictionName {
  choice_add = 'choice_add',
  choice_delete = 'choice_delete',
  choice_label_edit = 'choice_label_edit',
  choice_value_edit = 'choice_value_edit',
  choice_order_edit = 'choice_order_edit',
  question_delete = 'question_delete',
  question_label_edit = 'question_label_edit',
  question_settings_edit = 'question_settings_edit',
  question_skip_logic_edit = 'question_skip_logic_edit',
  question_validation_edit = 'question_validation_edit',
  group_delete = 'group_delete',
  group_label_edit = 'group_label_edit',
  group_question_add = 'group_question_add',
  group_question_delete = 'group_question_delete',
  group_question_order_edit = 'group_question_order_edit',
  group_settings_edit = 'group_settings_edit',
  group_skip_logic_edit = 'group_skip_logic_edit',
  group_split = 'group_split',
  form_appearance = 'form_appearance',
  form_meta_edit = 'form_meta_edit',
  form_replace = 'form_replace',
  group_add = 'group_add',
  question_add = 'question_add',
  question_order_edit = 'question_order_edit',
  language_edit = 'language_edit',
}

export interface LockingRestrictionDefinition {
  name: LockingRestrictionName;
  label: string;
}

export const LOCKING_RESTRICTIONS: {
  [P in LockingRestrictionName]: LockingRestrictionDefinition;
} = Object.freeze({
  // question related
  choice_add: {name: LockingRestrictionName.choice_add, label: t('Add choice to question')},
  choice_delete: {name: LockingRestrictionName.choice_delete, label: t('Remove choice from question')},
  choice_label_edit: {name: LockingRestrictionName.choice_label_edit, label: t('Edit choice labels')},
  choice_order_edit: {name: LockingRestrictionName.choice_order_edit, label: t('Change choice order')},
  choice_value_edit: {name: LockingRestrictionName.choice_value_edit, label: t('Edit choice values')},
  question_delete: {name: LockingRestrictionName.question_delete, label: t('Delete question')},
  question_label_edit: {name: LockingRestrictionName.question_label_edit, label: t('Edit question labels')},
  question_settings_edit: {name: LockingRestrictionName.question_settings_edit, label: t('Edit question settings')},
  question_skip_logic_edit: {name: LockingRestrictionName.question_skip_logic_edit, label: t('Edit skip logic')},
  question_validation_edit: {name: LockingRestrictionName.question_validation_edit, label: t('Edit validation')},
  // group related
  group_delete: {name: LockingRestrictionName.group_delete, label: t('Delete entire group')},
  group_label_edit: {name: LockingRestrictionName.group_label_edit, label: t('Edit group labels')},
  group_question_add: {name: LockingRestrictionName.group_question_add, label: t('Add question to group')},
  group_question_delete: {name: LockingRestrictionName.group_question_delete, label: t('Remove question from group')},
  group_question_order_edit: {name: LockingRestrictionName.group_question_order_edit, label: t('Change question order within group')},
  group_settings_edit: {name: LockingRestrictionName.group_settings_edit, label: t('Edit group settings')},
  group_skip_logic_edit: {name: LockingRestrictionName.group_skip_logic_edit, label: t('Edit skip logic')},
  group_split: {name: LockingRestrictionName.group_split, label: t('Split group')},
  // form related
  form_appearance: {name: LockingRestrictionName.form_appearance, label: t('Change form appearance')},
  form_meta_edit: {name: LockingRestrictionName.form_meta_edit, label: t('Change form meta questions')},
  form_replace: {name: LockingRestrictionName.form_replace, label: t('Replace whole form')},
  group_add: {name: LockingRestrictionName.group_add, label: t('Add group')},
  question_add: {name: LockingRestrictionName.question_add, label: t('Add question')},
  question_order_edit: {name: LockingRestrictionName.question_order_edit, label: t('Change question order')},
  language_edit: {name: LockingRestrictionName.language_edit, label: t('Change languages')},
});

// all restrictions for questions and choices
export const QUESTION_RESTRICTIONS = [
  LOCKING_RESTRICTIONS.choice_add,
  LOCKING_RESTRICTIONS.choice_delete,
  LOCKING_RESTRICTIONS.choice_label_edit,
  LOCKING_RESTRICTIONS.choice_order_edit,
  LOCKING_RESTRICTIONS.choice_value_edit,
  LOCKING_RESTRICTIONS.question_delete,
  LOCKING_RESTRICTIONS.question_label_edit,
  LOCKING_RESTRICTIONS.question_settings_edit,
  LOCKING_RESTRICTIONS.question_skip_logic_edit,
  LOCKING_RESTRICTIONS.question_validation_edit,
];

// all restrictions for groups
export const GROUP_RESTRICTIONS = [
  LOCKING_RESTRICTIONS.group_delete,
  LOCKING_RESTRICTIONS.group_label_edit,
  LOCKING_RESTRICTIONS.group_question_add,
  LOCKING_RESTRICTIONS.group_question_delete,
  LOCKING_RESTRICTIONS.group_question_order_edit,
  LOCKING_RESTRICTIONS.group_settings_edit,
  LOCKING_RESTRICTIONS.group_skip_logic_edit,
  LOCKING_RESTRICTIONS.group_split,
];

// all restrictions for form
export const FORM_RESTRICTIONS = [
  LOCKING_RESTRICTIONS.form_appearance,
  LOCKING_RESTRICTIONS.form_meta_edit,
  LOCKING_RESTRICTIONS.form_replace,
  LOCKING_RESTRICTIONS.group_add,
  LOCKING_RESTRICTIONS.question_add,
  LOCKING_RESTRICTIONS.question_order_edit,
  LOCKING_RESTRICTIONS.language_edit,
];

// currently lock_all has all restrictions,
// but we want to be flexible, so we use an array
export const LOCK_ALL_RESTRICTION_NAMES = [
  LockingRestrictionName.choice_add,
  LockingRestrictionName.choice_delete,
  LockingRestrictionName.choice_label_edit,
  LockingRestrictionName.choice_order_edit,
  LockingRestrictionName.choice_value_edit,
  LockingRestrictionName.question_delete,
  LockingRestrictionName.question_label_edit,
  LockingRestrictionName.question_settings_edit,
  LockingRestrictionName.question_skip_logic_edit,
  LockingRestrictionName.question_validation_edit,
  LockingRestrictionName.group_delete,
  LockingRestrictionName.group_label_edit,
  LockingRestrictionName.group_question_add,
  LockingRestrictionName.group_question_delete,
  LockingRestrictionName.group_question_order_edit,
  LockingRestrictionName.group_settings_edit,
  LockingRestrictionName.group_skip_logic_edit,
  LockingRestrictionName.group_split,
  LockingRestrictionName.form_appearance,
  LockingRestrictionName.form_meta_edit,
  LockingRestrictionName.form_replace,
  LockingRestrictionName.group_add,
  LockingRestrictionName.question_add,
  LockingRestrictionName.question_order_edit,
  LockingRestrictionName.language_edit,
];

export const LOCK_ALL_PROP_NAME = 'kobo--lock_all';

export const LOCKING_PROFILE_PROP_NAME = 'kobo--locking-profile';

export const LOCKING_PROFILES_PROP_NAME = 'kobo--locking-profiles';

export const LOCKING_UI_CLASSNAMES = {
  HIDDEN: 'locking__ui-hidden',
  DISABLED: 'locking__ui-disabled',
};
