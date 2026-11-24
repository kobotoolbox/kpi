import type { _DataResponseAttachmentsItem } from '#/api/models/_dataResponseAttachmentsItem'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import {
  getAutomaticTranscriptsFromSupplementData,
  getLatestTranscriptVersionItem,
} from '#/components/processing/common/utils'
import { getMediaAttachment } from '#/components/submissions/submissionUtils'
import type { SubmissionAttachment } from '#/dataInterface'
import { getEstimatedTranscriptionDurationSeconds } from '#/utils'

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
  // Rounded up, so the wording never promises less than the estimate.
  const minutes = Math.ceil(getEstimatedTranscriptionDurationSeconds(sourceSeconds) / 60)
  if (minutes <= 1) {
    return t('about a minute')
  }
  return t('about ##number## minutes').replace('##number##', String(minutes))
}

interface TranscriptionProgress {
  /** 0–99. Never 100, which would read as done. */
  percent: number
  /** Past the estimate. Show a message instead of a percentage stuck at 99%. */
  isOverdue: boolean
}

/**
 * Progress of the latest automatic transcript, from backend dates only, so a page reload doesn't reset it. The
 * version's `_dateCreated` is the start, and the action's `_dateModified` moves on each backend retry.
 */
export function getTranscriptionProgress(
  supplement: DataSupplementResponse,
  questionXpath: string,
  sourceSeconds: number,
): TranscriptionProgress | undefined {
  const latestVersion = getLatestTranscriptVersionItem(supplement, questionXpath)
  const action = getAutomaticTranscriptsFromSupplementData(supplement, questionXpath).find(([, transcript]) =>
    transcript._versions.some((version) => version === latestVersion),
  )?.[1]
  if (!latestVersion || !action) {
    return undefined
  }

  const estimateSeconds = getEstimatedTranscriptionDurationSeconds(sourceSeconds)
  // Not the action's `_dateCreated`, which dates its first ever version.
  const elapsedSeconds = (Date.parse(action._dateModified) - Date.parse(latestVersion._dateCreated)) / 1000
  return {
    percent: Math.max(0, Math.min(99, Math.floor((elapsedSeconds / estimateSeconds) * 100))),
    isOverdue: elapsedSeconds > estimateSeconds,
  }
}
