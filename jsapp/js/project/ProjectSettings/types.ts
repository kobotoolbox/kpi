import type { PROJECT_SETTINGS_CONTEXTS } from '#/constants'
import type { AssetResponse } from '#/dataInterface'

/**
 * Type for the context in which ProjectSettings is being used.
 * Extracted using TypeScript's type utilities to ensure it stays in sync with the constant.
 */
export type ProjectSettingsContext = (typeof PROJECT_SETTINGS_CONTEXTS)[keyof typeof PROJECT_SETTINGS_CONTEXTS]

/**
 * Form fields for project settings. Note that `sector`, `country`,
 * `operational_purpose` and `collects_pii` are stored as `LabelValuePair`s in the
 * asset settings, but here we only keep their values around.
 * `getSettingsForEndpoint` pairs them up with their labels again.
 */
export interface ProjectSettingsFields {
  name: string
  description: string
  sector: string | null
  country: string[] | null
  operational_purpose: string | null
  collects_pii: string | null
  // Admin-configured custom fields can be text, single-select, or multi-select
  extra_metadata_fields: Record<string, string | string[] | null>
}

export interface ProjectSettingsProps {
  /** Determines which mode: NEW (create), REPLACE (replace form), or EXISTING (edit settings) */
  context: ProjectSettingsContext
  /** The asset being edited (only for EXISTING and REPLACE contexts) */
  formAsset?: AssetResponse
  /** If provided, automatically applies this template when creating a new project */
  initialTemplateUid?: string | null
  /** Optional callback for listening to field changes (used by parent components) */
  onProjectDetailsChange?: (data: { fieldName: string; fieldValue: string | string[] | null }) => void
  /** Optional callback to update the modal title as user navigates between steps */
  onSetModalTitle?: (title: string) => void
  /** Close the mantine modal wrapper. Currently exists alongside legcaly modal management through pageState. */
  onRequestClose?: () => void
}
