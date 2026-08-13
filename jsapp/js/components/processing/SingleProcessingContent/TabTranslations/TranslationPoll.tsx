import cx from 'classnames'
import React from 'react'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { LanguageCode } from '#/components/languages/languagesStore'
import ConflictingOngoingJobAlert from '#/components/processing/common/ConflictingOngoingJobAlert'
import { isConflictingOngoingJobForSubmission } from '#/components/processing/common/conflictingOngoingJob'
import { useSupplementStatusPolling } from '#/components/processing/common/useSupplementStatusPolling'
import { getLatestTranscriptVersionItem, isSupplementVersionWithValue } from '#/components/processing/common/utils'
import type { AssetResponse } from '#/dataInterface'
import { getSubmissionRootUuid } from '#/utils'
import bodyStyles from '../../common/processingBody.module.scss'

const MIN_FIRST_POLL_DELAY_MS = 3000
const MAX_FIRST_POLL_DELAY_MS = 30000
// TODO: Calibrate this heuristic with real telemetry (chars vs completion time)
// instead of relying on a hand-picked chars-per-second value.
const CHARS_PER_SECOND = 250

function getTranslationFirstPollDelayMs(transcriptCharacters: number): number {
  // Approximate translation throughput and wait for about half of estimated completion time.
  const estimatedTranslationSeconds = Math.ceil(transcriptCharacters / CHARS_PER_SECOND)
  const delayMs = Math.round((estimatedTranslationSeconds * 1000) / 2)
  return Math.max(MIN_FIRST_POLL_DELAY_MS, Math.min(MAX_FIRST_POLL_DELAY_MS, delayMs))
}

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  supplement: DataSupplementResponse
  languageCode: LanguageCode
  activeBulkActions: BulkActionResponse[]
}

export default function TranslationPoll({
  asset,
  questionXpath,
  submission,
  supplement,
  languageCode,
  activeBulkActions,
}: Props) {
  // Nothing is blocked here, but the spinner alone doesn't say who started the work.
  // Naming the bulk job explains why this appeared without the user asking for it.
  // The language is known at this point, so the check can be the precise one.
  const hasConflictingOngoingJob = isConflictingOngoingJobForSubmission({
    activeBulkActions,
    actionType: 'translation',
    fieldXpath: questionXpath,
    submissionUuid: getSubmissionRootUuid(submission),
    selectedLanguage: languageCode,
  })

  const transcriptVersion = getLatestTranscriptVersionItem(supplement, questionXpath)
  const transcriptCharacters =
    transcriptVersion && isSupplementVersionWithValue(transcriptVersion) ? transcriptVersion._data.value.length : 0
  const firstPollDelayMs = transcriptCharacters
    ? getTranslationFirstPollDelayMs(transcriptCharacters)
    : MIN_FIRST_POLL_DELAY_MS

  useSupplementStatusPolling(asset, submission, { firstPollDelayMs })

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
      <LoadingSpinner type='big' message={false} />

      <header className={bodyStyles.header}>{t('Automatic translation in progress')}</header>

      <p>{t('Language: ##language##').replace('##language##', languageCode)}</p>
      <p>{t('This may take up to a couple of minutes.')}</p>

      {hasConflictingOngoingJob && (
        <ConflictingOngoingJobAlert mt='md'>
          {t('This submission is part of an ongoing bulk processing job.')}
        </ConflictingOngoingJobAlert>
      )}
    </div>
  )
}
