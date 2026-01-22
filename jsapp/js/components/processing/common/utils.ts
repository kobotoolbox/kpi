import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItem'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import { ADVANCED_FEATURES_ACTION } from './constants'
import type { OneOfTransx, TranscriptVersionItem, TranslationDataWithValue } from './types'

export function isSupplementVersionWithValue<
  T extends
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem =
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem,
>(supplementData: T): supplementData is T & { _data: { value: string } } {
  return supplementData._data && 'value' in supplementData._data && typeof supplementData._data.value === 'string'
}

export const isSupplementVersionAutomatic = (
  SupplementVersion:
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem,
): SupplementVersion is _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem => {
  return 'status' in SupplementVersion._data
}

export const getVersionsFromTransxArray = (transxArray: Array<OneOfTransx>) => {
  return transxArray.flatMap((transx) => transx._versions)
}

export const getLastVersionFromTransxArray = (transxArray: Array<OneOfTransx>) => {
  const versions = getVersionsFromTransxArray(transxArray)
  return versions.sort((a, b) => (a._dateCreated < b._dateCreated ? 1 : -1))[0]
}

// Transcriptions
export const getManualTranscriptsFromSupplementData = (supplementData: DataSupplementResponse, xpath: string) => {
  return supplementData[xpath]?.[ADVANCED_FEATURES_ACTION.manual_transcription]
}

export const getAutomaticTranscriptsFromSupplementData = (supplementData: DataSupplementResponse, xpath: string) => {
  return Object.entries(supplementData[xpath]).filter(([key, _value]) => key.match(/^automatic_.+_transcription$/))
}

export const getAllTranscriptsFromSupplementData = (supplementData: DataSupplementResponse, xpath: string) => {
  return [
    getManualTranscriptsFromSupplementData(supplementData, xpath),
    ...getAutomaticTranscriptsFromSupplementData(supplementData, xpath).map(([, value]) => value),
  ].filter(Boolean)
}

export const getLatestTranscriptVersionItem = (supplementData: DataSupplementResponse, xpath: string) => {
  const allTranscripts = getAllTranscriptsFromSupplementData(supplementData, xpath)
  return getLastVersionFromTransxArray(allTranscripts as Array<OneOfTransx>) as TranscriptVersionItem | undefined
}

// Translations

export const getManualTranslationsFromSupplementData = (supplementData: DataSupplementResponse, xpath: string) => {
  return supplementData[xpath]?.[ADVANCED_FEATURES_ACTION.manual_translation]
}

export const getAutomaticTranslationsFromSupplementData = (supplementData: DataSupplementResponse, xpath: string) => {
  return Object.entries(supplementData[xpath]).filter(([key, _value]) => key.match(/^automatic_.+_translation$/))
}

export const getAllTranslationsFromSupplementData = (supplementData: DataSupplementResponse, xpath: string) => {
  const translations = [
    getManualTranslationsFromSupplementData(supplementData, xpath),
    ...getAutomaticTranslationsFromSupplementData(supplementData, xpath).map(([, value]) => value),
  ]

  const allTranslationVersions: TranslationDataWithValue[] = []

  for (const translation of translations) {
    for (const entry of Object.entries(translation || {})) {
      const [, value] = entry
      allTranslationVersions.push(...(value._versions || []))
    }
  }

  return allTranslationVersions
}
