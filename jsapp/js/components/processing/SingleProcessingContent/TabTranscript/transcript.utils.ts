import type { DataResponse } from '#/api/models/dataResponse'
import { findRowByXpath, getRowName } from '#/assetUtils'
import { getMediaAttachment, getRowData } from '#/components/submissions/submissionUtils'
import type { AssetResponse, SubmissionAttachment } from '#/dataInterface'
import { convertSecondsToMinutes } from '#/utils'

function getQuestionName(asset: AssetResponse, xpath: string) {
  if (!asset?.content) return undefined
  const foundRow = findRowByXpath(asset.content, xpath)
  return foundRow ? getRowName(foundRow) : undefined
}

/**
 * Returns an error string or the attachment. It's basically a wrapper function
 * over `getMediaAttachment` for DRY purposes.
 */
export function getAttachmentForProcessing(
  asset: AssetResponse,
  questionXPath: string,
  submissionData?: DataResponse,
): string | SubmissionAttachment {
  const errorMessage = 'Insufficient data'

  const currentQuestionName = getQuestionName(asset, questionXPath)
  // We need `assetContent` with survey, submission data, and question name to
  // go further.
  if (!asset?.content?.survey || !submissionData || !currentQuestionName) {
    return errorMessage
  }

  const rowData = getRowData(currentQuestionName, asset.content.survey, submissionData)
  // We need row data to go further. And we are expecting a string (filename).
  if (!rowData || typeof rowData !== 'string') {
    return errorMessage
  }

  return getMediaAttachment(submissionData, rowData, questionXPath)
}

/**
 * For given length of an audio file (in seconds) returns a human-friendly
 * rough estimate of how long would it take to transcribe it.
 */
export function secondsToTranscriptionEstimate(sourceSeconds: number): string {
  const durationSeconds = Math.round(sourceSeconds * 0.5 + 10)
  if (durationSeconds < 45) {
    return t('less than a minute')
  } else if (durationSeconds >= 45 && durationSeconds < 75) {
    return t('about 1 minute')
  } else if (durationSeconds >= 75 && durationSeconds < 150) {
    return t('about 2 minutes')
  } else {
    const durationMinutes = convertSecondsToMinutes(durationSeconds)
    return t('about ##number## minutes').replace('##number##', String(durationMinutes))
  }
}
