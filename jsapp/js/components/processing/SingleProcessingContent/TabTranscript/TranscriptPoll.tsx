import cx from 'classnames'
import React, { useEffect, useState } from 'react'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import LoadingSpinner from '#/components/common/loadingSpinner'
import ConflictingOngoingJobAlert from '#/components/processing/common/ConflictingOngoingJobAlert'
import { isConflictingOngoingJobForSubmission } from '#/components/processing/common/conflictingOngoingJob'
import { useSupplementStatusPolling } from '#/components/processing/common/useSupplementStatusPolling'
import type { AssetResponse } from '#/dataInterface'
import { getAudioDuration, getEstimatedTranscriptionDurationSeconds, getSubmissionRootUuid } from '#/utils'
import bodyStyles from '../../common/processingBody.module.scss'
import { getAttachmentForProcessing, secondsToTranscriptionEstimate } from './transcript.utils'

/** Until the estimate is loaded we display dot dot dot. */
const NO_ESTIMATED_MINUTES = '…'
const MIN_FIRST_POLL_DELAY_MS = 3000
const MAX_FIRST_POLL_DELAY_MS = 30000

function getFirstPollDelayMs(sourceDurationSeconds: number): number {
  // Poll later for longer recordings to reduce unnecessary early refetches.
  const estimatedDurationSeconds = getEstimatedTranscriptionDurationSeconds(sourceDurationSeconds)
  return Math.max(
    MIN_FIRST_POLL_DELAY_MS,
    Math.min(MAX_FIRST_POLL_DELAY_MS, Math.round((estimatedDurationSeconds * 1000) / 3)),
  )
}

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  activeBulkActions: BulkActionResponse[]
}

export default function AutomaticTranscriptionInProgress({
  asset,
  questionXpath,
  submission,
  activeBulkActions,
}: Props) {
  const [estimate, setEstimate] = useState<string>(NO_ESTIMATED_MINUTES)
  const [firstPollDelayMs, setFirstPollDelayMs] = useState<number>(MIN_FIRST_POLL_DELAY_MS)

  // Nothing is blocked here, but the spinner alone doesn't say who started the work.
  // Naming the bulk job explains why this appeared without the user asking for it.
  const hasConflictingOngoingJob = isConflictingOngoingJobForSubmission({
    activeBulkActions,
    actionType: 'transcript',
    fieldXpath: questionXpath,
    submissionUuid: getSubmissionRootUuid(submission),
  })

  useSupplementStatusPolling(asset, submission, { firstPollDelayMs })

  useEffect(() => {
    const attachment = getAttachmentForProcessing(questionXpath, submission)
    if (typeof attachment !== 'string') {
      getAudioDuration(attachment.download_url).then((length: number) => {
        setEstimate(secondsToTranscriptionEstimate(length))
        setFirstPollDelayMs(getFirstPollDelayMs(length))
      })
    }
  }, [asset, questionXpath, submission])

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
      <LoadingSpinner type='big' message={false} />

      <header className={bodyStyles.header}>{t('Automatic transcription in progress')}</header>

      <p>{t('Estimated time for completion: ##estimate##').replace('##estimate##', estimate)}</p>

      {hasConflictingOngoingJob && (
        <ConflictingOngoingJobAlert mt='md'>
          {t('This submission is part of an ongoing bulk processing job.')}
        </ConflictingOngoingJobAlert>
      )}
    </div>
  )
}
