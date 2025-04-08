import assetStore from '#/assetStore'
import singleProcessingStore from '#/components/processing/singleProcessingStore'
import { getMediaAttachment, getQuestionXPath, getRowData } from '#/components/submissions/submissionUtils'
import type { SubmissionAttachment } from '#/dataInterface'
import { convertSecondsToMinutes } from '#/utils'

/**
 * Returns an error string or the attachment. It's basically a wrapper function
 * over `getMediaAttachment` for DRY purposes in `singleProcessingStore` context.
 */
export function getAttachmentForProcessing(): string | SubmissionAttachment {
  const errorMessage = 'Insufficient data'

  const asset = assetStore.getAsset(singleProcessingStore.currentAssetUid)

  const submissionData = singleProcessingStore.getSubmissionData()
  const currentQuestionName = singleProcessingStore.currentQuestionName
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

  const questionXPath = getQuestionXPath(asset.content.survey, currentQuestionName)

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
