import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from "#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem"
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItem } from "#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItem"
import { findRowByXpath, getRowName } from "#/assetUtils"
import { type AnyRowTypeName, QUESTION_TYPES } from "#/constants"
import type { AssetResponse } from "#/dataInterface"

// TODO: improve schema to enum `action` prop.
export enum ADVANCED_FEATURES_ACTION {
  manual_transcription = 'manual_transcription',
  manual_translation = 'manual_translation',
  automatic_google_transcription = 'automatic_google_transcription',
  automatic_google_translation = 'automatic_google_translation',
}

export const isTranscriptVersionAutomatic = (
  transcriptVersion:
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem,
): transcriptVersion is _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem => {
  return 'status' in transcriptVersion._data
}

export function getQuestionName(asset: AssetResponse, questionXpath: string) {
  if (!asset?.content) return undefined
  const foundRow = findRowByXpath(asset.content, questionXpath)
  return foundRow ? getRowName(foundRow) : undefined
}

export function getProcessedFileLabel(questionType: AnyRowTypeName) {
    if (questionType === QUESTION_TYPES.audio.id) {
      return QUESTION_TYPES.audio.label.toLowerCase()
    } else if (questionType === QUESTION_TYPES['background-audio'].id) {
      return QUESTION_TYPES['background-audio'].label.toLowerCase()
    }
    // Fallback
    return t('source file')
  }
