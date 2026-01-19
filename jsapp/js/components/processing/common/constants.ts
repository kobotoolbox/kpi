/**
 * See also `SCHEMA_VERSIONS` at `kobo/apps/subsequences/constants.py`.
 */
export const SUBSEQUENCES_SCHEMA_VERSION = '20250820'

// TODO: improve schema to enum `action` prop.
export enum ADVANCED_FEATURES_ACTION {
  manual_transcription = 'manual_transcription',
  manual_translation = 'manual_translation',
  automatic_google_transcription = 'automatic_google_transcription',
  automatic_google_translation = 'automatic_google_translation',
}
