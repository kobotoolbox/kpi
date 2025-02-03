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

// all restrictions for questions and choices
export const QUESTION_RESTRICTIONS: LockingRestrictionDefinition[] = [
  {name: LockingRestrictionName.choice_add, label: t('Add choice to question')},
  {name: LockingRestrictionName.choice_delete, label: t('Remove choice from question')},
  {name: LockingRestrictionName.choice_label_edit, label: t('Edit choice labels')},
  {name: LockingRestrictionName.choice_order_edit, label: t('Change choice order')},
  {name: LockingRestrictionName.choice_value_edit, label: t('Edit choice values')},
  {name: LockingRestrictionName.question_delete, label: t('Delete question')},
  {name: LockingRestrictionName.question_label_edit, label: t('Edit question labels')},
  {name: LockingRestrictionName.question_settings_edit, label: t('Edit question settings')},
  {name: LockingRestrictionName.question_skip_logic_edit, label: t('Edit skip logic')},
  {name: LockingRestrictionName.question_validation_edit, label: t('Edit validation')},
];

// all restrictions for groups
export const GROUP_RESTRICTIONS: LockingRestrictionDefinition[] = [
  {name: LockingRestrictionName.group_delete, label: t('Delete entire group')},
  {name: LockingRestrictionName.group_label_edit, label: t('Edit group labels')},
  {name: LockingRestrictionName.group_question_add, label: t('Add question to group')},
  {name: LockingRestrictionName.group_question_delete, label: t('Remove question from group')},
  {name: LockingRestrictionName.group_question_order_edit, label: t('Change question order within group')},
  {name: LockingRestrictionName.group_settings_edit, label: t('Edit group settings')},
  {name: LockingRestrictionName.group_skip_logic_edit, label: t('Edit skip logic')},
  {name: LockingRestrictionName.group_split, label: t('Split group')},
];

// all restrictions for form
export const FORM_RESTRICTIONS: LockingRestrictionDefinition[] = [
  {name: LockingRestrictionName.form_appearance, label: t('Change form appearance')},
  {name: LockingRestrictionName.form_meta_edit, label: t('Change form meta questions')},
  {name: LockingRestrictionName.form_replace, label: t('Replace whole form')},
  {name: LockingRestrictionName.group_add, label: t('Add group')},
  {name: LockingRestrictionName.question_add, label: t('Add question')},
  {name: LockingRestrictionName.question_order_edit, label: t('Change question order')},
  {name: LockingRestrictionName.language_edit, label: t('Change languages')},
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
