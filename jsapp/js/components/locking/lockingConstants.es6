/**
 * TODO notes
 *
 * https://github.com/kobotoolbox/kpi/issues/3032
 *
 * https://docs.google.com/spreadsheets/d/1JI2JQ2UFrPvUh3ZuwiAoMBrol_KshkIARloSTi6UOM4/edit#gid=1847621029
 *
 * form is "locked" if at least one question, one group or the form itself has a locking profile assigned
 *
 * Things to actually do:
 * 1. Create information message with:
 *   - toggle
 *   - list of can/cant do
 *   - legend
 * 2. color options for rows (multiple)
 * 3. lock icon (in color, over regular icon)
 * 4. special big tooltip for disabled row icon
 * 5. restriction based UI changes (mainly attribute disable - with pointer events and opacity)
 *   - disable delete row button
 *   - disable choice add button
 *   - disable choice delete button
 *   - disable choice label
 *   - disable row label
 *   - disable all question settings editing
 *   - disable skip logic editing
 *   - disable constraint editing
 *   - disable deleting rows inside question
 *   - disable group delete
 *   - disable group label
 *   - disable row label inside group
 *   - disable all group settings editing
 *   - disable group skip logic
 *   - disable add any row
 *   - disable change translation
 * 6. restriction based functionality changes:
 *   - disable choice order change
 *   - disable adding row to group
 *   - disable question order change
 *   - disable add translation
 *   - disable replacing form
 * 7. restricted form info near title
 */

// NOTE to self: please try to use "lockpick" name for anything

export const LOCKING_RESTRICTIONS = Object.freeze({
  // question related
  choice_add: {name: 'choice_add', label: t('Add choice to question')},
  choice_delete: {name: 'choice_delete', label: t('Remove choice from question')},
  choice_edit: {name: 'choice_edit', label: t('Edit choice labels')},
  choice_order_edit: {name: 'choice_order_edit', label: t('Change choice order')},
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
  group_skip_logic_edit: {name: 'skip_logic_edit', label: t('Edit skip logic')},
  // form related
  form_replace: {name: 'form_replace', label: t('Replace whole form')},
  group_add: {name: 'group_add', label: t('Add group')},
  question_add: {name: 'question_add', label: t('Add question')},
  question_order_edit: {name: 'question_order_edit', label: t('Change question order')},
  translation_manage: {name: 'translation_manage', label: t('Manage translations')},
});

export const QUESTION_RESTRICTION_NAMES = [
  LOCKING_RESTRICTIONS.choice_add.name,
  LOCKING_RESTRICTIONS.choice_delete.name,
  LOCKING_RESTRICTIONS.choice_edit.name,
  LOCKING_RESTRICTIONS.choice_order_edit.name,
  LOCKING_RESTRICTIONS.question_delete.name,
  LOCKING_RESTRICTIONS.question_label_edit.name,
  LOCKING_RESTRICTIONS.question_settings_edit.name,
  LOCKING_RESTRICTIONS.question_skip_logic_edit.name,
  LOCKING_RESTRICTIONS.question_validation_edit.name,
];

export const GROUP_RESTRICTION_NAMES = [
  LOCKING_RESTRICTIONS.group_delete.name,
  LOCKING_RESTRICTIONS.group_label_edit.name,
  LOCKING_RESTRICTIONS.group_question_add.name,
  LOCKING_RESTRICTIONS.group_question_delete.name,
  LOCKING_RESTRICTIONS.group_question_order_edit.name,
  LOCKING_RESTRICTIONS.group_settings_edit.name,
  LOCKING_RESTRICTIONS.group_skip_logic_edit.name,
];

export const FORM_RESTRICTION_NAMES = [
  LOCKING_RESTRICTIONS.form_replace.name,
  LOCKING_RESTRICTIONS.group_add.name,
  LOCKING_RESTRICTIONS.question_add.name,
  LOCKING_RESTRICTIONS.question_order_edit.name,
  LOCKING_RESTRICTIONS.translation_manage.name,
];

// group + question restriction names
export const ROW_RESTRICTION_NAMES = [].concat(
  QUESTION_RESTRICTION_NAMES,
  GROUP_RESTRICTION_NAMES,
);

// currently lock_all has all restrictions,
// but we want to be flexible, so we use an array
export const LOCK_ALL_RESTRICTION_NAMES = [
  LOCKING_RESTRICTIONS.choice_add.name,
  LOCKING_RESTRICTIONS.choice_delete.name,
  LOCKING_RESTRICTIONS.choice_edit.name,
  LOCKING_RESTRICTIONS.choice_order_edit.name,
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
  LOCKING_RESTRICTIONS.form_replace.name,
  LOCKING_RESTRICTIONS.group_add.name,
  LOCKING_RESTRICTIONS.question_add.name,
  LOCKING_RESTRICTIONS.question_order_edit.name,
  LOCKING_RESTRICTIONS.translation_manage.name,
];

export const LOCK_ALL_PROP_NAME = 'kobo--lock_all';

export const LOCKING_PROFILE_PROP_NAME = 'kobo--locking-profile';

export const LOCKING_PROFILES_PROP_NAME = 'kobo--locking-profiles';
