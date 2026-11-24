import cx from 'classnames'
import React from 'react'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import LoadingSpinner from '#/components/common/loadingSpinner'
import ConflictingOngoingJobAlert from '#/components/processing/common/ConflictingOngoingJobAlert'
import { isConflictingOngoingJobForSubmission } from '#/components/processing/common/conflictingOngoingJob'
import { useSupplementStatusPolling } from '#/components/processing/common/useSupplementStatusPolling'
import { SUPPLEMENT_MAX_FIRST_POLL_DELAY, SUPPLEMENT_MIN_FIRST_POLL_DELAY } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { getEstimatedTranscriptionDurationSeconds, getSubmissionRootUuid } from '#/utils'
import bodyStyles from '../../common/processingBody.module.scss'
import { getTranscriptionProgress, secondsToTranscriptionEstimate } from './transcript.utils'
import { useTranscriptionSourceSeconds } from './useTranscriptionSourceSeconds'

/** Until the estimate is loaded we display dot dot dot. */
const NO_ESTIMATED_MINUTES = '…'

function getFirstPollDelayMs(sourceDurationSeconds: number | undefined): number {
  if (sourceDurationSeconds === undefined) return SUPPLEMENT_MIN_FIRST_POLL_DELAY
  // Poll later for longer recordings to reduce unnecessary early refetches.
  const estimatedDurationSeconds = getEstimatedTranscriptionDurationSeconds(sourceDurationSeconds)
  return Math.max(
    SUPPLEMENT_MIN_FIRST_POLL_DELAY,
    Math.min(SUPPLEMENT_MAX_FIRST_POLL_DELAY, Math.round((estimatedDurationSeconds * 1000) / 3)),
  )
}

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  supplement: DataSupplementResponse
  activeBulkActions: BulkActionResponse[]
}

export default function AutomaticTranscriptionInProgress({
  asset,
  questionXpath,
  submission,
  supplement,
  activeBulkActions,
}: Props) {
  const sourceSeconds = useTranscriptionSourceSeconds(asset, questionXpath, submission)
  const progress =
    sourceSeconds === undefined ? undefined : getTranscriptionProgress(supplement, questionXpath, sourceSeconds)

  // Nothing is blocked here, but the spinner alone doesn't say who started the work.
  // Naming the bulk job explains why this appeared without the user asking for it.
  const hasConflictingOngoingJob = isConflictingOngoingJobForSubmission({
    activeBulkActions,
    actionType: 'transcript',
    fieldXpath: questionXpath,
    submissionUuid: getSubmissionRootUuid(submission),
  })

  useSupplementStatusPolling(asset, submission, { firstPollDelayMs: getFirstPollDelayMs(sourceSeconds) })

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
      <LoadingSpinner type='big' message={false} />

      <header className={bodyStyles.header}>{t('Automatic transcription in progress')}</header>

      {progress && (
        <p>
          {progress.isOverdue
            ? t('This is taking longer than expected.')
            : t('##percent##% complete').replace('##percent##', String(progress.percent))}
        </p>
      )}

      <p>
        {t('Estimated time for completion: ##estimate##').replace(
          '##estimate##',
          sourceSeconds === undefined ? NO_ESTIMATED_MINUTES : secondsToTranscriptionEstimate(sourceSeconds),
        )}
      </p>

      {hasConflictingOngoingJob && (
        <ConflictingOngoingJobAlert mt='md'>
          {t('This submission is part of an ongoing bulk processing job.')}
        </ConflictingOngoingJobAlert>
      )}
    </div>
  )
}
