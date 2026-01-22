import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItemDataOneOfThree } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItemDataOneOfThree'
import type { _DataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem'
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItemData } from '#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItemData'
import type { _DataSupplementResponseOneOfManualTranslationVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranslationVersionsItem'
import type { _DataSupplementResponseOneOfQualVersionsItem } from '#/api/models/_dataSupplementResponseOneOfQualVersionsItem'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { StaticDisplays } from './utils'

export type OneOfTransx = {
  _versions: Array<
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
    | _DataSupplementResponseOneOfManualTranslationVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem
    | _DataSupplementResponseOneOfQualVersionsItem
  >
}

export type TranscriptVersionItem =
  | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
  | _DataSupplementResponseOneOfManualTranscriptionVersionsItem

export type TranslationVersionItem =
  | _DataSupplementResponseOneOfManualTranslationVersionsItem
  | _DataSupplementResponseOneOfAutomaticGoogleTranslationVersionsItem

export type QualVersionItem = _DataSupplementResponseOneOfQualVersionsItem

export type TransxVersionItem = TranscriptVersionItem | TranslationVersionItem | QualVersionItem

export type TranscriptVersionItemWithValue =
  | _DataSupplementResponseOneOfManualTranscriptionVersionsItemData
  | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItemDataOneOfThree

export type DisplaysList = Array<LanguageCode | StaticDisplays>
