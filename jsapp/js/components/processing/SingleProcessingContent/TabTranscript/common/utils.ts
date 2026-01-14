import { findRowByXpath, getRowName } from "#/assetUtils"
import { type AnyRowTypeName, QUESTION_TYPES } from "#/constants"
import type { AssetResponse } from "#/dataInterface"

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
