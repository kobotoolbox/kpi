import { findRowByXpath, getRowName } from '#/assetUtils'
import { type AnyRowTypeName, QUESTION_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'

export function getQuestionName(asset: AssetResponse, questionXpath: string) {
  if (!asset?.content) return undefined
  const foundRow = findRowByXpath(asset.content, questionXpath)
  return foundRow ? getRowName(foundRow) : undefined
}

export function getQuestionType(asset: AssetResponse, questionXpath: string): AnyRowTypeName | undefined {
  if (!asset?.content) return undefined
  const foundRow = findRowByXpath(asset.content, questionXpath)
  return foundRow?.type
}

/**
 * This is being used in few places to replace placeholder in UI translation text. Few places refers to this as "##type##",
 * which is the type of the question the response to which we are processing. Most of the times it will be "audio".
 */
export function getProcessedFileLabel(questionType: AnyRowTypeName | undefined) {
  if (questionType === QUESTION_TYPES.audio.id) {
    return QUESTION_TYPES.audio.label.toLowerCase()
  } else if (questionType === QUESTION_TYPES['background-audio'].id) {
    return QUESTION_TYPES['background-audio'].label.toLowerCase()
  }
  // Fallback
  return t('source file')
}
