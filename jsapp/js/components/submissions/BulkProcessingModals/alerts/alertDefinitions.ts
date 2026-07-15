import { formatTimeFromSeconds } from '#/utils'
import {
  evaluateAlreadyTranscribed,
  evaluateAlreadyTranslated,
  evaluateConflictingJob,
  evaluateNearLimit,
  evaluateNoEligibleSubmissions,
  evaluateNoSource,
  evaluateReachedLimit,
} from './alertEvaluators'
import type { AlertDefinition, BulkActionType } from './types'

/**
 * Get alert definitions for the given action type
 * Alerts are evaluated in array order - first alert has highest priority
 */
export function getAlertDefinitions(actionType: BulkActionType): AlertDefinition[] {
  const isTranscription = actionType === 'transcript'

  return [
    {
      id: 'reached-limit',
      type: 'error',
      evaluator: evaluateReachedLimit,
      messageTemplate: () =>
        isTranscription
          ? t(
              'You have reached your transcription limit. Please select fewer files, purchase an add-on, or upgrade your plan.',
            )
          : t(
              'You have reached your translation limit. Please select fewer files, purchase an add-on, or upgrade your plan.',
            ),
    },
    {
      id: 'near-limit',
      type: 'error',
      evaluator: evaluateNearLimit,
      messageTemplate: (values) => {
        const remaining = isTranscription
          ? formatTimeFromSeconds(Number(values.remainingSeconds ?? 0))
          : (values.remainingCharacters ?? '0')
        return isTranscription
          ? t(
              '##remainingDuration## of automated transcription left, that is not enough to process all selected submissions. Please select fewer files, purchase an add-on, or upgrade your plan.',
            ).replace('##remainingDuration##', String(remaining))
          : t(
              '##remainingCharacters## characters of automated translation left, that is not enough to process all selected submissions. Please select fewer files, purchase an add-on, or upgrade your plan.',
            ).replace('##remainingCharacters##', String(remaining))
      },
    },
    {
      id: 'conflicting-job',
      type: 'warning',
      evaluator: evaluateConflictingJob,
      messageTemplate: ({ count = 0 }) =>
        (count === 1
          ? t('1 submission is already being processed by another job and will be ignored')
          : t('##count## submissions are already being processed by another job and will be ignored')
        ).replace('##count##', String(count)),
    },
    {
      id: 'no-source',
      type: 'warning',
      evaluator: evaluateNoSource,
      messageTemplate: ({ count = 0 }) =>
        isTranscription
          ? (count === 1
              ? t('1 submission is missing audio file and will be ignored')
              : t('##count## submissions are missing audio file and will be ignored')
            ).replace('##count##', String(count))
          : (count === 1
              ? t('1 submission is missing transcription and will be ignored')
              : t('##count## submissions are missing transcription and will be ignored')
            ).replace('##count##', String(count)),
    },
    {
      id: isTranscription ? 'already-transcribed' : 'already-translated',
      type: 'warning',
      evaluator: isTranscription ? evaluateAlreadyTranscribed : evaluateAlreadyTranslated,
      messageTemplate: (values) => {
        const count = values.count ?? 0
        return isTranscription
          ? (count === 1
              ? t('1 audio file totaling ##duration## already transcribed and will be ignored')
              : t('##count## audio files totaling ##duration## already transcribed and will be ignored')
            )
              .replace('##count##', String(count))
              .replace('##duration##', String(values.duration ?? formatTimeFromSeconds(0)))
          : (count === 1
              ? t('1 transcript totaling ##characters## characters already translated and will be ignored')
              : t('##count## transcripts totaling ##characters## characters already translated and will be ignored')
            )
              .replace('##count##', String(count))
              .replace('##characters##', String(values.characters ?? 0))
      },
    },
    {
      id: 'no-eligible-submissions',
      type: 'error',
      evaluator: evaluateNoEligibleSubmissions,
      messageTemplate: () => t('There are no eligible submissions to process.'),
    },
  ]
}
