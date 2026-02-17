import type { SupplementalDataTranscriptionAutomaticVersion } from '#/api/models/supplementalDataTranscriptionAutomaticVersion'
import type { SupplementalDataContentAutomatic } from '#/api/models/supplementalDataContentAutomatic'
import type { SupplementalDataTranslationAutomaticVersion } from '#/api/models/supplementalDataTranslationAutomaticVersion'
import type { SupplementalDataVersionItemQual } from '#/api/models/supplementalDataVersionItemQual'
import type { SupplementalDataTranscriptionManualVersion } from '#/api/models/supplementalDataTranscriptionManualVersion'
import type { SupplementalDataContentManual } from '#/api/models/supplementalDataContentManual'
import type { SupplementalDataContentAutomaticComplete } from '#/api/models/supplementalDataContentAutomaticComplete'
import type { SupplementalDataContentAutomaticDeleted } from '#/api/models/supplementalDataContentAutomaticDeleted'
import type { SupplementalDataTranslationManualVersion } from '#/api/models/supplementalDataTranslationManualVersion'
import type { PatchedDataSupplementPayloadOneOfManualQual } from '#/api/models/patchedDataSupplementPayloadOneOfManualQual'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { StaticDisplays } from './utils'

export type OneOfTransx = {
  _versions: Array<
    | SupplementalDataTranscriptionManualVersion
    | SupplementalDataTranscriptionAutomaticVersion
    | SupplementalDataTranslationManualVersion
    | SupplementalDataTranslationAutomaticVersion
    | SupplementalDataVersionItemQual
  >
}

export type TranscriptVersionItem =
  | SupplementalDataTranscriptionAutomaticVersion
  | SupplementalDataTranscriptionManualVersion

export type TranslationVersionItem =
  | SupplementalDataTranslationManualVersion
  | SupplementalDataTranslationAutomaticVersion

export type QualVersionItem = SupplementalDataVersionItemQual

export type TransxVersionItem = TranscriptVersionItem | TranslationVersionItem | QualVersionItem

export type TranscriptVersionItemWithValue =
  | SupplementalDataContentManual
  | SupplementalDataContentAutomaticComplete
  | SupplementalDataContentAutomaticDeleted

export type DisplaysList = Array<LanguageCode | StaticDisplays>

type ManualQualWithValue = Extract<PatchedDataSupplementPayloadOneOfManualQual, { value: any }>
export type ManualQualValue = ManualQualWithValue['value']

export enum CreateSteps {
  Begin = 'begin',
  Language = 'language',
  Manual = 'manual',
  Automatic = 'automatic',
}
