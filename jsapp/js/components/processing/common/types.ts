import type { SupplementalDataVersionItemAutomatic } from '#/api/models/supplementalDataVersionItemAutomatic'
import type { SupplementalDataVersionItemManual } from '#/api/models/supplementalDataVersionItemManual'
import type { SupplementalDataVersionItemQual } from '#/api/models/supplementalDataVersionItemQual'
import type { SupplementalDataManualTranscription } from '#/api/models/supplementalDataManualTranscription'
import type { SupplementalDataAutomaticTranscription } from '#/api/models/supplementalDataAutomaticTranscription'
import type { SupplementalDataManualTranslationItem } from '#/api/models/supplementalDataManualTranslationItem'
import type { SupplementalDataAutomaticTranslationItem } from '#/api/models/supplementalDataAutomaticTranslationItem'
import type { SupplementalDataManualQualItem } from '#/api/models/supplementalDataManualQualItem'
import type { SupplementalDataAutomaticQualItem } from '#/api/models/supplementalDataAutomaticQualItem'

import type { SupplementalDataVersionItemAutomaticWithDep } from '#/api/models/supplementalDataVersionItemAutomaticWithDep'
import type { SupplementalDataVersionItemManualWithDep } from '#/api/models/supplementalDataVersionItemManualWithDep'

import type { SupplementalDataContentAutomatic } from '#/api/models/supplementalDataContentAutomatic'
import type { SupplementalDataContentManual } from '#/api/models/supplementalDataContentManual'
import type { SupplementalDataContentAutomaticComplete } from '#/api/models/supplementalDataContentAutomaticComplete'
import type { SupplementalDataContentAutomaticDeleted } from '#/api/models/supplementalDataContentAutomaticDeleted'
import type { PatchedDataSupplementPayloadOneOfManualQual } from '#/api/models/patchedDataSupplementPayloadOneOfManualQual'
import type { LanguageCode } from '#/components/languages/languagesStore'
import type { StaticDisplays } from './utils'

export type OneOfTransx =
  | SupplementalDataManualTranscription
  | SupplementalDataAutomaticTranscription
  | SupplementalDataManualTranslationItem
  | SupplementalDataAutomaticTranslationItem
  | SupplementalDataManualQualItem
  | SupplementalDataAutomaticQualItem

export type TranscriptVersionItem =
  | SupplementalDataVersionItemAutomatic
  | SupplementalDataVersionItemManual

// ... (keep existing imports, just adding these)

export type TranslationVersionItem =
  | SupplementalDataVersionItemManualWithDep
  | SupplementalDataVersionItemAutomaticWithDep

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
