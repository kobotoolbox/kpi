/**
 * TODO notes
 *
 * there are three types of restrictions: question, group, form
 *
 * form has list of custom locking profile (plus two default ones)
 *
 * locking profile can be assigned to form, group and question
 *
 * locking profile has a name, label and list of enabled restrictions
 *
 * restriction definitions are hardcoded on FE
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

export const QUESTION_RESTRICTIONS = Object.freeze({
  question_delete: {
    name: 'question_delete',
    label: t('Delete question'),
  },
  choice_add: {
    name: 'choice_add',
    label: t('Add choice to question'),
  },
  choice_delete: {
    name: 'choice_delete',
    label: t('Remove choice from question'),
  },
  question_label_edit: {
    name: 'question_label_edit',
    label: t('Edit question labels'),
  },
  choice_label_edit: {
    name: 'choice_label_edit',
    label: t('Edit choice labels'),
  },
  choice_order_edit: {
    name: 'choice_order_edit',
    label: t('Change choice order'),
  },
  question_settings_edit: {
    name: 'question_settings_edit',
    label: t('Edit question settings'),
  },
  skip_logic_edit: {
    name: 'skip_logic_edit',
    label: t('Edit skip logic'),
  },
  constraint_edit: {
    name: 'constraint_edit',
    label: t('Edit constraint'),
  },
});

export const GROUP_RESTRICTIONS = Object.freeze({
  group_question_add: {
    name: 'group_question_add',
    label: t('Add question to group'),
  },
  group_question_delete: {
    name: 'group_question_delete',
    label: t('Remove question from group'),
  },
  group_delete: {
    name: 'group_delete',
    label: t('Delete entire group'),
  },
  group_label_edit: {
    name: 'group_label_edit',
    label: t('Edit group labels'),
  },
  group_question_label_edit: {
    name: 'group_question_label_edit',
    label: t('Change question order within group'),
  },
  group_settings_edit: {
    name: 'group_settings_edit',
    label: t('Edit group settings'),
  },
  skip_logic_edit: {
    name: 'skip_logic_edit',
    label: t('Edit skip logic'),
  },
  question_children_delete: {
    name: 'question_children_delete',
    label: t('Child questions can be removed'),
  },
});

export const FORM_RESTRICTIONS = Object.freeze({
  question_add: {
    name: 'question_add',
    label: t('Add question'),
  },
  group_add: {
    name: 'group_add',
    label: t('Add group'),
  },
  question_order_edit: {
    name: 'question_order_edit',
    label: t('Change question order'),
  },
  translation_add: {
    name: 'translation_add',
    label: t('Add translation'),
  },
  xlsform_replace: {
    name: 'xlsform_replace',
    label: t('Replace form from XLSForm'),
  },
});

export const DEFAULT_LOCKING_PROFILE = {
  name: 'kobo',
  label: t('Default'),
  restrictions: [],
};
DEFAULT_LOCKING_PROFILE.restrictions = [].concat(
  Object.keys(QUESTION_RESTRICTIONS),
  Object.keys(GROUP_RESTRICTIONS),
  Object.keys(FORM_RESTRICTIONS)
);
Object.freeze(DEFAULT_LOCKING_PROFILE);

// unlocked profile is just an absence of profile

// ??
export const CUSTOM_LOCKING_PROFILE_COLORS = {
  // 4 colors
};

// ??
export const CUSTOM_LOCKING_PROFILE_ICONS = {
  // 4 icons
};

export const LOCKING_PROP_NAME = 'kobo--lock';


// TODO
//
// 1. function to check if has X restriction
// 2. disabling things
