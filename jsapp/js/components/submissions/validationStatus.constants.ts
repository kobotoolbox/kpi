/**
 * These are the names of main options for `ValidationStatusDropdown`, and all
 * validation statuses that Back end understands.
 */
export enum ValidationStatusName {
  validation_status_not_approved = 'validation_status_not_approved',
  validation_status_approved = 'validation_status_approved',
  validation_status_on_hold = 'validation_status_on_hold',
}

/**
 * These are the names of additional options for `ValidationStatusDropdown`.
 */
export enum ValidationStatusAdditionalName {
  no_status = 'no_status',
  show_all = 'show_all',
}

/**
 * These are all names of all options for `ValidationStatusDropdown`.
 */
export type ValidationStatusOptionName = ValidationStatusName | ValidationStatusAdditionalName;

export interface ValidationStatusOption {
  value: ValidationStatusOptionName;
  label: string;
}

/**
 * Additional option for `ValidationStatusDropdown`, it's the one for when it's
 * being used as a table header filter.
 */
export const VALIDATION_STATUS_SHOW_ALL_OPTION: ValidationStatusOption = {
  value: ValidationStatusAdditionalName.show_all,
  label: t('Show All'),
};

export const VALIDATION_STATUS_NO_OPTION: ValidationStatusOption = {
  value: ValidationStatusAdditionalName.no_status,
  label: '-',
};

/** List of options for `ValidationStatusDropdown` */
export const VALIDATION_STATUS_OPTIONS: ValidationStatusOption[] = [
  VALIDATION_STATUS_NO_OPTION,
  {
    value: ValidationStatusName.validation_status_not_approved,
    label: t('Not approved'),
  },
  {
    value: ValidationStatusName.validation_status_approved,
    label: t('Approved'),
  },
  {
    value: ValidationStatusName.validation_status_on_hold,
    label: t('On hold'),
  },
];

/**
 * List of options for `ValidationStatusDropdown`, including the additional one.
 */
export const VALIDATION_STATUS_OPTIONS_WITH_SHOW_ALL = [
  VALIDATION_STATUS_SHOW_ALL_OPTION,
  ...VALIDATION_STATUS_OPTIONS
];
