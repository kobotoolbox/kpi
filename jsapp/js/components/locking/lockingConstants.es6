// NOTE: this list should match a list from:
// https://github.com/kobotoolbox/formpack/blob/master/src/formpack/constants.py
export const LOCKING_RESTRICTIONS = Object.freeze({
  // question related
  choice_add: {name: 'choice_add', label: t('Add choice to question')},
  choice_delete: {name: 'choice_delete', label: t('Remove choice from question')},
  choice_label_edit: {name: 'choice_label_edit', label: t('Edit choice labels')},
  choice_order_edit: {name: 'choice_order_edit', label: t('Change choice order')},
  choice_value_edit: {name: 'choice_value_edit', label: t('Edit choice values')},
  question_delete: {name: 'question_delete', label: t('Delete question')},
  question_label_edit: {name: 'question_label_edit', label: t('Edit question labels')},
  question_settings_edit: {name: 'question_settings_edit', label: t('Edit question settings')},
  question_skip_logic_edit: {name: 'question_skip_logic_edit', label: t('Edit skip logic')},
  question_validation_edit: {name: 'question_validation_edit', label: t('Edit validation')},
  // group related
  group_delete: {name: 'group_delete', label: t('Delete entire group')},
  group_label_edit: {name: 'group_label_edit', label: t('Edit group labels')},
  group_question_add: {name: 'group_question_add', label: t('Add question to group')},
  group_question_delete: {name: 'group_question_delete', label: t('Remove question from group')},
  group_question_order_edit: {name: 'group_question_order_edit', label: t('Change question order within group')},
  group_settings_edit: {name: 'group_settings_edit', label: t('Edit group settings')},
  group_skip_logic_edit: {name: 'group_skip_logic_edit', label: t('Edit skip logic')},
  group_split: {name: 'group_split', label: t('Split group')},
  // form related
  form_replace: {name: 'form_replace', label: t('Replace whole form')},
  group_add: {name: 'group_add', label: t('Add group')},
  question_add: {name: 'question_add', label: t('Add question')},
  question_order_edit: {name: 'question_order_edit', label: t('Change question order')},
  translations_manage: {name: 'translations_manage', label: t('Manage translations')},
});

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
export const FORM_RESTRICTIONS = [
  LOCKING_RESTRICTIONS.form_replace,
  LOCKING_RESTRICTIONS.group_add,
  LOCKING_RESTRICTIONS.question_add,
  LOCKING_RESTRICTIONS.question_order_edit,
  LOCKING_RESTRICTIONS.translations_manage,
];

// currently lock_all has all restrictions,
// but we want to be flexible, so we use an array
export const LOCK_ALL_RESTRICTION_NAMES = [
  LOCKING_RESTRICTIONS.choice_add.name,
  LOCKING_RESTRICTIONS.choice_delete.name,
  LOCKING_RESTRICTIONS.choice_label_edit.name,
  LOCKING_RESTRICTIONS.choice_order_edit.name,
  LOCKING_RESTRICTIONS.choice_value_edit.name,
  LOCKING_RESTRICTIONS.question_delete.name,
  LOCKING_RESTRICTIONS.question_label_edit.name,
  LOCKING_RESTRICTIONS.question_settings_edit.name,
  LOCKING_RESTRICTIONS.question_skip_logic_edit.name,
  LOCKING_RESTRICTIONS.question_validation_edit.name,
  LOCKING_RESTRICTIONS.group_delete.name,
  LOCKING_RESTRICTIONS.group_label_edit.name,
  LOCKING_RESTRICTIONS.group_question_add.name,
  LOCKING_RESTRICTIONS.group_question_delete.name,
  LOCKING_RESTRICTIONS.group_question_order_edit.name,
  LOCKING_RESTRICTIONS.group_settings_edit.name,
  LOCKING_RESTRICTIONS.group_skip_logic_edit.name,
  LOCKING_RESTRICTIONS.group_split.name,
  LOCKING_RESTRICTIONS.form_replace.name,
  LOCKING_RESTRICTIONS.group_add.name,
  LOCKING_RESTRICTIONS.question_add.name,
  LOCKING_RESTRICTIONS.question_order_edit.name,
  LOCKING_RESTRICTIONS.translations_manage.name,
];

export const LOCK_ALL_PROP_NAME = 'kobo--lock_all';

export const LOCKING_PROFILE_PROP_NAME = 'kobo--locking-profile';

export const LOCKING_PROFILES_PROP_NAME = 'kobo--locking-profiles';

export const LOCKING_UI_CLASSNAMES = {
  HIDDEN: 'locking__ui-hidden',
  DISABLED: 'locking__ui-disabled',
};
