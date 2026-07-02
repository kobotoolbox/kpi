/**
 * Step configuration for the project settings wizard.
 * Each step has a unique identifier and translated title.
 *
 * Flow:
 * - NEW/REPLACE context: FORM_SOURCE → [CHOOSE_TEMPLATE | UPLOAD_FILE | IMPORT_URL] → PROJECT_DETAILS
 * - EXISTING context: PROJECT_DETAILS only (editing existing project)
 */
export const STEPS = {
  FORM_SOURCE: 'form-source',
  CHOOSE_TEMPLATE: 'choose-template',
  UPLOAD_FILE: 'upload-file',
  IMPORT_URL: 'import-url',
  PROJECT_DETAILS: 'project-details',
} as const

export type StepName = (typeof STEPS)[keyof typeof STEPS]

export const STEP_TITLES: Record<StepName, string> = {
  [STEPS.FORM_SOURCE]: t('Choose a source'),
  [STEPS.CHOOSE_TEMPLATE]: t('Choose template'),
  [STEPS.UPLOAD_FILE]: t('Upload XLSForm'),
  [STEPS.IMPORT_URL]: t('Import XLSForm'),
  [STEPS.PROJECT_DETAILS]: t('Project details'),
}

export function getStepTitle(step: StepName): string {
  return STEP_TITLES[step] || ''
}
