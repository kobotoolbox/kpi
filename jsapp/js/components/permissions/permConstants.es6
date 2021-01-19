// suffixes
export const SUFFIX_USERS = 'Users';
export const SUFFIX_PARTIAL = 'Partial';

// This list is a bit overkill, but it saves the trouble of making
// a hard to debug typo bug while using these names
export const PERM_CHECKBOX_NAMES = {};
new Set([
  'formView',
  'formEdit',
  'submissionsAdd',
  'submissionsAddPartial',
  'submissionsView',
  'submissionsViewPartial',
  'submissionsEdit',
  'submissionsEditPartial',
  'submissionsValidate',
  'submissionsValidatePartial',
  'submissionsDelete',
]).forEach((name) => {PERM_CHECKBOX_NAMES[name] = name;});
Object.freeze(PERM_CHECKBOX_NAMES);

export const PARTIAL_CHECKBOX_PAIRS = {};
PARTIAL_CHECKBOX_PAIRS[PERM_CHECKBOX_NAMES.submissionsAdd] = PERM_CHECKBOX_NAMES.submissionsAddPartial;
PARTIAL_CHECKBOX_PAIRS[PERM_CHECKBOX_NAMES.submissionsView] = PERM_CHECKBOX_NAMES.submissionsViewPartial;
PARTIAL_CHECKBOX_PAIRS[PERM_CHECKBOX_NAMES.submissionsEdit] = PERM_CHECKBOX_NAMES.submissionsEditPartial;
PARTIAL_CHECKBOX_PAIRS[PERM_CHECKBOX_NAMES.submissionsValidate] = PERM_CHECKBOX_NAMES.submissionsValidatePartial;
Object.freeze(PARTIAL_CHECKBOX_PAIRS);
