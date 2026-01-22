import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItem'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { DataSupplementResponseOneOfManualTranslation } from '#/api/models/dataSupplementResponseOneOfManualTranslation'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { ProcessingTab } from '#/components/processing/routes.utils'
import { ADVANCED_FEATURES_ACTION } from './constants'
import type {
  DisplaysList,
  OneOfTransx,
  TranscriptVersionItem,
  TranslationVersionItem,
  TransxVersionItem,
} from './types'

/**
 * Type guard to check if a supplement version has a value property.
 *
 * @param supplementData - The supplement data to check
 * @returns True if the supplement data has a value property
 */
export function isSupplementVersionWithValue<
  T extends
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem =
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem,
>(supplementData: T): supplementData is T & { _data: { value: string } } {
  return supplementData._data && 'value' in supplementData._data && typeof supplementData._data.value === 'string'
}

/**
 * Type guard to check if a supplement version is automatic (vs manual).
 *
 * @param SupplementVersion - The supplement version to check
 * @returns True if the supplement version is automatic
 */
export const isSupplementVersionAutomatic = (
  SupplementVersion:
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem,
): SupplementVersion is _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem => {
  return 'status' in SupplementVersion._data
}

/**
 * Sort function for TransxVersionItem objects by date created (newest first).
 *
 * @param a - First version item
 * @param b - Second version item
 * @returns Comparison result for sorting
 */
const TransxVersionSortFunction = (a: TransxVersionItem, b: TransxVersionItem): number => {
  return a._dateCreated < b._dateCreated ? 1 : -1
}

// Transcriptions

/**
 * Retrieves manual transcription data for a specific field from supplement data.
 *
 * @param supplementData - The supplement data object
 * @param xpath - The field xpath to retrieve transcription for
 * @returns The manual transcription object, or undefined if not found
 */
export const getManualTranscriptsFromSupplementData = (
  supplementData: DataSupplementResponse,
  xpath: string,
): OneOfTransx | undefined => {
  return supplementData[xpath]?.[ADVANCED_FEATURES_ACTION.manual_transcription]
}

/**
 * Retrieves all automatic transcription data for a specific field from supplement data.
 *
 * @param supplementData - The supplement data object
 * @param xpath - The field xpath to retrieve transcriptions for
 * @returns Array of tuples containing the key and transcription object
 */
export const getAutomaticTranscriptsFromSupplementData = (
  supplementData: DataSupplementResponse,
  xpath: string,
): Array<[string, OneOfTransx]> => {
  return Object.entries(supplementData[xpath] || {}).filter(([key, _value]) =>
    key.match(/^automatic_.+_transcription$/),
  ) as Array<[string, OneOfTransx]>
}

/**
 * Retrieves all transcriptions (manual and automatic) for a specific field from supplement data.
 *
 * @param supplementData - The supplement data object
 * @param xpath - The field xpath to retrieve transcriptions for
 * @returns Array of all transcription objects
 */
export const getAllTranscriptsFromSupplementData = (
  supplementData: DataSupplementResponse,
  xpath: string,
): Array<OneOfTransx> => {
  return [
    getManualTranscriptsFromSupplementData(supplementData, xpath),
    ...getAutomaticTranscriptsFromSupplementData(supplementData, xpath).map(([, value]) => value),
  ].filter(Boolean) as Array<OneOfTransx>
}

/**
 * Gets the most recent transcript version for a specific field.
 *
 * @param supplementData - The supplement data object
 * @param xpath - The field xpath to retrieve transcript for
 * @returns The most recent transcript version, or undefined if none exist
 */
export const getLatestTranscriptVersionItem = (
  supplementData: DataSupplementResponse,
  xpath: string,
): TranscriptVersionItem | undefined => {
  const allTranscripts = getAllTranscriptsFromSupplementData(supplementData, xpath)
  return allTranscripts.flatMap((transcript) => transcript._versions).sort(TransxVersionSortFunction)[0] as
    | TranscriptVersionItem
    | undefined
}

// Translations

/**
 * Retrieves manual translation data for a specific field from supplement data.
 *
 * @param supplementData - The supplement data object
 * @param xpath - The field xpath to retrieve translation for
 * @returns The manual translation object, or undefined if not found
 */
export const getManualTranslationsFromSupplementData = (
  supplementData: DataSupplementResponse,
  xpath: string,
): DataSupplementResponseOneOfManualTranslation | undefined => {
  return supplementData[xpath]?.[ADVANCED_FEATURES_ACTION.manual_translation]
}

/**
 * Retrieves all automatic translation data for a specific field from supplement data.
 *
 * @param supplementData - The supplement data object
 * @param xpath - The field xpath to retrieve translations for
 * @returns Array of tuples containing the key and translation object
 */
export const getAutomaticTranslationsFromSupplementData = (
  supplementData: DataSupplementResponse,
  xpath: string,
): Array<[string, OneOfTransx]> => {
  return Object.entries(supplementData[xpath] || {}).filter(([key, _value]) =>
    key.match(/^automatic_.+_translation$/),
  ) as Array<[string, OneOfTransx]>
}

/**
 * Returns an array of the latest TranslationVersionItem for each language found in the supplement data.
 *
 * @param supplementData - The supplement data object
 * @param xpath - The field xpath to retrieve translations for
 * @returns Array of the most recent translation version for each language
 */
export const getAllTranslationsFromSupplementData = (
  supplementData: DataSupplementResponse,
  xpath: string,
): TranslationVersionItem[] => {
  const translations = [
    getManualTranslationsFromSupplementData(supplementData, xpath),
    ...getAutomaticTranslationsFromSupplementData(supplementData, xpath).map(([, value]) => value),
  ].filter(Boolean)

  const allTranslationVersions: TranslationVersionItem[] = []
  const languageSet = new Set<LanguageCode>()

  for (const translation of translations) {
    if (!translation) continue

    for (const value of Object.values(translation)) {
      if (value?._versions) {
        allTranslationVersions.push(...value._versions)
        for (const version of value._versions) {
          languageSet.add(version._data.language)
        }
      }
    }
  }

  const latestVersions: TranslationVersionItem[] = []

  Array.from(languageSet).forEach((language) => {
    const versionsForLanguage = allTranslationVersions.filter((version) => version._data.language === language)
    const latestVersion = versionsForLanguage.sort(TransxVersionSortFunction)[0]
    if (latestVersion) {
      latestVersions.push(latestVersion)
    }
  })

  return latestVersions
}

// Displays

export enum StaticDisplays {
  Data = 'Data',
  Audio = 'Audio',
  Transcript = 'Transcript',
}

export const DefaultDisplays: Map<ProcessingTab, DisplaysList> = new Map([
  [ProcessingTab.Transcript, [StaticDisplays.Audio, StaticDisplays.Data]],
  [ProcessingTab.Translations, [StaticDisplays.Audio, StaticDisplays.Data, StaticDisplays.Transcript]],
  [ProcessingTab.Analysis, [StaticDisplays.Audio, StaticDisplays.Data, StaticDisplays.Transcript]],
])

/**
 * Gets the default displays for a given processing tab.
 *
 * @param tabName - The processing tab name
 * @returns Array of default displays for the tab, or empty array if undefined
 */
export const getDefaultDisplaysForTab = (tabName: ProcessingTab | undefined): DisplaysList => {
  if (tabName === undefined) {
    return []
  }
  return DefaultDisplays.get(tabName) || []
}
