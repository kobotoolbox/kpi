import type { _DataResponseAttachmentsItem } from '#/api/models/_dataResponseAttachmentsItem'
import type { DataResponse } from '#/api/models/dataResponse'
import { getMediaAttachment } from '#/components/submissions/submissionUtils'
import type { SubmissionAttachment } from '#/dataInterface'
import { convertSecondsToMinutes } from '#/utils'

/**
 * Returns an error string or the attachment. It's basically a wrapper function
 * over `getMediaAttachment` for DRY purposes.
 */
export function getAttachmentForProcessing(
  questionXPath: string,
  submissionData?: DataResponse,
): string | SubmissionAttachment {
  const errorMessage = 'Insufficient data'
  const fileName = submissionData?._attachments?.find(
    (attachment: _DataResponseAttachmentsItem) => attachment.question_xpath === questionXPath,
  )?.filename
  if (!fileName) {
    return errorMessage
  }

  return getMediaAttachment(submissionData, fileName, questionXPath)
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
