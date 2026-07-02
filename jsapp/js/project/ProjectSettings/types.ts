import type { PROJECT_SETTINGS_CONTEXTS } from '#/constants'
import type { AssetResponse, LabelValuePair } from '#/dataInterface'
import type { WithRouterProps } from '#/router/legacy'
import type { StepName } from './constants'

/**
 * Type for the context in which ProjectSettings is being used.
 * Extracted using TypeScript's type utilities to ensure it stays in sync with the constant.
 */
export type ProjectSettingsContext = (typeof PROJECT_SETTINGS_CONTEXTS)[keyof typeof PROJECT_SETTINGS_CONTEXTS]

/**
 * Form fields for project settings.
 * Note: Some fields use LabelValuePair for compatibility with react-select components.
 */
export interface ProjectSettingsFields {
  name: string
  description: string
  // Single-select fields use LabelValuePair (e.g., {value: 'health', label: 'Health'})
  sector: LabelValuePair | null
  // Multi-select field - country can have multiple selections
  country: LabelValuePair[] | null
  operational_purpose: LabelValuePair | null
  collects_pii: LabelValuePair | null
  // Admin-configured custom fields can be text, single-select, or multi-select
  extra_metadata_fields: Record<string, string | string[] | null>
}

export interface ProjectSettingsProps extends WithRouterProps {
  /** Determines which mode: NEW (create), REPLACE (replace form), or EXISTING (edit settings) */
  context: ProjectSettingsContext
  /** The asset being edited (only for EXISTING and REPLACE contexts) */
  formAsset?: AssetResponse
  /** If provided, automatically applies this template when creating a new project */
  initialTemplateUid?: string | null
  /** Optional callback for listening to field changes (used by parent components) */
  onProjectDetailsChange?: (data: {
    fieldName: string
    fieldValue: string | string[] | LabelValuePair | LabelValuePair[] | null
  }) => void
  /** Optional callback to update the modal title as user navigates between steps */
  onSetModalTitle?: (title: string) => void
}

export interface ProjectSettingsState {
  // Loading states
  isSessionLoaded: boolean
  isSubmitPending: boolean

  // Asset data
  /** The asset being created or edited - populated after template/upload/import */
  formAsset?: AssetResponse

  // Form data
  fields: ProjectSettingsFields
  /** List of field names that failed validation */
  fieldsWithErrors: string[]

  // Multi-step wizard navigation
  /** Current step in the wizard (null during initial load) */
  currentStep: StepName | null
  /** Previous step (used for back button navigation) */
  previousStep: StepName | null

  // URL import state
  isImportFromURLPending: boolean
  importUrl: string
  importUrlButtonEnabled: boolean
  importUrlButton: string

  // Template selection state
  isApplyTemplatePending: boolean
  applyTemplateButton: string
  chosenTemplateUid: string | null
  /** Used to track async template cloning and prevent race conditions */
  pendingTemplateCloneUid: string | null

  // File upload state
  isUploadFilePending: boolean

  // Archive/unarchive flow state
  /** Waiting for archive operation to complete before navigating away */
  isAwaitingArchiveCompleted: boolean
  /** Waiting for unarchive operation to complete before navigating away */
  isAwaitingUnarchiveCompleted: boolean
}
