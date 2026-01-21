import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem'
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfManualTranslationVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranslationVersionsItem'
import type { DataSupplementResponseOneOf } from '#/api/models/dataSupplementResponseOneOf'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { recordKeys, recordValues } from '#/utils'

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

export const getTranscriptFromSupplement = (supplementQuestion: DataSupplementResponseOneOf) => {
  const transcriptVersion = [
    ...(supplementQuestion?.manual_transcription?._versions || []),
    ...(supplementQuestion?.automatic_google_transcription?._versions || []),
  ].sort((a, b) => (a._dateCreated < b._dateCreated ? 1 : -1))[0]

  return transcriptVersion
}

export const getTranslationsFromSupplement = (supplementQuestion: DataSupplementResponseOneOf) => {
  const languages = [
    ...recordKeys(supplementQuestion?.manual_translation ?? {}),
    ...recordKeys(supplementQuestion?.automatic_google_translation ?? {}),
  ] as LanguageCode[]
  const translationVersions = recordValues(
    languages.reduce(
      (map, language) => {
        map[language] = [
          ...(supplementQuestion?.manual_translation?.[language]?._versions || []),
          ...(supplementQuestion?.automatic_google_translation?.[language]?._versions || []),
        ].sort((a, b) => (a._dateCreated < b._dateCreated ? 1 : -1))[0]
        return map
      },
      {} as Record<
        LanguageCode,
        | _DataSupplementResponseOneOfManualTranslationVersionsItem
        | _DataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem
      >,
    ),
  ).filter(isSupplementVersionWithValue)

  return translationVersions
}
