import { ActionEnum } from '#/api/models/actionEnum'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { SupplementalDataAutomaticTranscription } from '#/api/models/supplementalDataAutomaticTranscription'
import type { SupplementalDataAutomaticTranslation } from '#/api/models/supplementalDataAutomaticTranslation'
import type { SupplementalDataManualTranscription } from '#/api/models/supplementalDataManualTranscription'
import type { SupplementalDataManualTranslation } from '#/api/models/supplementalDataManualTranslation'
import type { SupplementalDataVersionItemAutomatic } from '#/api/models/supplementalDataVersionItemAutomatic'
import type { SupplementalDataVersionItemManual } from '#/api/models/supplementalDataVersionItemManual'

import type { LanguageCode } from '#/components/languages/languagesStore'
import { ProcessingTab } from '#/components/processing/routes.utils'
import type {
  DisplaysList,
  QualVersionItem,
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
  T extends SupplementalDataVersionItemAutomatic | SupplementalDataVersionItemManual =
    | SupplementalDataVersionItemAutomatic
    | SupplementalDataVersionItemManual,
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
  SupplementVersion: SupplementalDataVersionItemManual | SupplementalDataVersionItemAutomatic,
): SupplementVersion is SupplementalDataVersionItemAutomatic => {
  return 'status' in SupplementVersion._data
}

/**
 * Sort function for TransxVersionItem objects by date created (newest first).
 *
 * @param a - First version item
 * @param b - Second version item
 * @returns Comparison result for sorting
 */
export const TransxVersionSortFunction = (a: TransxVersionItem, b: TransxVersionItem): number => {
  return a._dateCreated < b._dateCreated ? 1 : -1
}

/**
 * Returns all transcript versions (both manual and automatic) for given question
 */
export const getAllTranscriptVersions = (supplementData: DataSupplementResponse, xpath: string) => {
  return [
    ...(supplementData[xpath]?.manual_transcription?._versions || []),
    ...(supplementData[xpath]?.automatic_google_transcription?._versions || []),
  ]
}

/**
 * Checks if given version item is a transcript
 */
export const isVersionItemTranscript = (
  supplementData: DataSupplementResponse,
  xpath: string,
  transxVersion: TransxVersionItem,
): boolean => {
  return getAllTranscriptVersions(supplementData, xpath).some((transcript) => transcript._uuid === transxVersion._uuid)
}

/**
 * Returns all translation versions (both manual and automatic) for given question for all languages (flat list)
 */
export const getAllTranslationVersions = (supplementData: DataSupplementResponse, xpath: string) => {
  const translations = [
    getManualTranslationsFromSupplementData(supplementData, xpath),
    ...getAutomaticTranslationsFromSupplementData(supplementData, xpath).map(([, value]) => value),
  ].filter(Boolean)

  const allTranslationVersions: TranslationVersionItem[] = []

  for (const translation of translations) {
    if (!translation) continue
    for (const value of Object.values(translation)) {
      if (value?._versions) {
        allTranslationVersions.push(...value._versions)
      }
    }
  }
  return allTranslationVersions
}

/**
 * Returns all translation versions (both manual and automatic) for given question for given language
 */
export const getAllTranslationVersionsForLanguage = (
  supplementData: DataSupplementResponse,
  xpath: string,
  languageCode: LanguageCode,
) => {
  return getAllTranslationVersions(supplementData, xpath).filter(
    (translation) => translation._data.language === languageCode,
  )
}

/**
 * Checks if given version item is a translation
 */
export const isVersionItemTranslation = (
  supplementData: DataSupplementResponse,
  xpath: string,
  transxVersion: TransxVersionItem,
): boolean => {
  const allTranslationVersions = getAllTranslationVersions(supplementData, xpath)
  return allTranslationVersions.some((translation) => translation._uuid === transxVersion._uuid)
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
): SupplementalDataManualTranscription | undefined => {
  return supplementData[xpath]?.[ActionEnum.manual_transcription]
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
): Array<[string, SupplementalDataAutomaticTranscription]> => {
  return Object.entries(supplementData[xpath] || {}).filter(([key, _value]) =>
    key.match(/^automatic_.+_transcription$/),
  ) as Array<[string, SupplementalDataAutomaticTranscription]>
}

/**
 * Retrieves all transcriptions (manual and automatic) for a specific field from supplement data.
 * Including ones without values?
 *
 * @param supplementData - The supplement data object
 * @param xpath - The field xpath to retrieve transcriptions for
 * @returns Array of all transcription objects
 */
export const getAllTranscriptsFromSupplementData = (
  supplementData: DataSupplementResponse,
  xpath: string,
): Array<SupplementalDataManualTranscription | SupplementalDataAutomaticTranscription> => {
  return [
    getManualTranscriptsFromSupplementData(supplementData, xpath),
    ...getAutomaticTranscriptsFromSupplementData(supplementData, xpath).map(([, value]) => value),
  ].filter((item): item is SupplementalDataManualTranscription | SupplementalDataAutomaticTranscription => !!item)
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
  return getAllTranscriptsFromSupplementData(supplementData, xpath)
    .flatMap<TranscriptVersionItem>((transcript) => transcript._versions)
    .sort(TransxVersionSortFunction)[0] as TranscriptVersionItem | undefined
}

// Qual

/**
 * Gets the most recent qual version item for a specific field and question UUID,
 * combining both manual_qual and automatic_bedrock_qual versions.
 *
 * @param supplementData - The supplement data object
 * @param xpath - The field xpath to retrieve qual for
 * @param questionUuid - The UUID of the qual question
 * @returns The most recent qual version item, or undefined if none exist
 */
export const getLatestQualVersionItem = (
  supplementData: DataSupplementResponse,
  xpath: string,
  questionUuid: string,
): QualVersionItem | undefined => {
  const manualVersions = supplementData[xpath]?.[ActionEnum.manual_qual]?.[questionUuid]?._versions ?? []
  const automaticVersions = supplementData[xpath]?.[ActionEnum.automatic_bedrock_qual]?.[questionUuid]?._versions ?? []
  const allVersions = [...manualVersions, ...automaticVersions] as QualVersionItem[]
  return allVersions.sort(TransxVersionSortFunction)[0]
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
): SupplementalDataManualTranslation | undefined => {
  return supplementData[xpath]?.[ActionEnum.manual_translation]
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
): Array<[string, SupplementalDataAutomaticTranslation]> => {
  return Object.entries(supplementData[xpath] || {}).filter(([key, _value]) =>
    key.match(/^automatic_.+_translation$/),
  ) as Array<[string, SupplementalDataAutomaticTranslation]>
}

/**
 * Gets the most recent translation version for a specific field and language.
 *
 * @param supplementData - The supplement data object
 * @param xpath - The field xpath to retrieve translation for
 * @param languageCode
 * @returns The most recent translation version, or undefined if none exist
 */
export const getLatestAutomaticTranslationVersionItem = (
  supplementData: DataSupplementResponse,
  xpath: string,
  languageCode?: LanguageCode,
  includeWithoutValue = true,
): TranslationVersionItem | undefined => {
  const allTranslations = getAllTranslationsFromSupplementData(supplementData, xpath, includeWithoutValue)
  const filtered = allTranslations.filter((translation) => !languageCode || translation._data.language === languageCode)
  return filtered.sort(TransxVersionSortFunction)[0] as TranslationVersionItem | undefined
}

/**
 * Returns an array of the latest TranslationVersionItem for each language found in the supplement data.
 *
 * @param supplementData - The supplement data object
 * @param xpath - The field xpath to retrieve translations for
 * @param [includeWithoutValue] - Whether to return latest versions that are failed etc.
 * @returns Array of the most recent translation version for each language
 */
export const getAllTranslationsFromSupplementData = (
  supplementData: DataSupplementResponse,
  xpath: string,
  includeWithoutValue = true,
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
    if (latestVersion && (isSupplementVersionWithValue(latestVersion) || includeWithoutValue)) {
      latestVersions.push(latestVersion)
    }
  })

  return latestVersions
}

// Displays

export enum StaticDisplays {
  // Keep the enum ordering, since it controls the order of display options in the UI
  Audio = 'Audio',
  Data = 'Data',
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
