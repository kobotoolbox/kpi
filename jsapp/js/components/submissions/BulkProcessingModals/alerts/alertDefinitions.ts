import {
  validateAlreadyTranscribed,
  validateAlreadyTranslated,
  validateConflictingJob,
  validateNearLimit,
  validateNoEligibleSubmissions,
  validateNoSource,
  validateReachedLimit,
} from './alertValidators'
import type { AlertDefinition, BulkActionType } from './types'

/**
 * Get alert definitions for the given action type
 * Ordered by priority (1 is the highest priority)
 */
export function getAlertDefinitions(actionType: BulkActionType): AlertDefinition[] {
  const isTranscription = actionType === 'transcript'

  return [
    {
      id: 'reached-limit',
      type: 'error',
      priority: 1,
      validator: validateReachedLimit,
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
      priority: 2,
      validator: validateNearLimit,
      messageTemplate: (values) => {
        const remaining = isTranscription ? (values.remainingMinutes ?? '0') : (values.remainingCharacters ?? '0')
        return isTranscription
          ? t(
              '##remainingMinutes## minutes of automated transcription left, that is not enough to process all selected submissions. Please select fewer files, purchase an add-on, or upgrade your plan.',
            ).replace('##remainingMinutes##', String(remaining))
          : t(
              '##remainingCharacters## characters of automated translation left, that is not enough to process all selected submissions. Please select fewer files, purchase an add-on, or upgrade your plan.',
            ).replace('##remainingCharacters##', String(remaining))
      },
    },
    {
      id: 'conflicting-job',
      type: 'warning',
      priority: 3,
      validator: validateConflictingJob,
      messageTemplate: () => t('Another bulk process is already in progress, please let it finish first'),
    },
    {
      id: 'no-source',
      type: 'warning',
      priority: 4,
      validator: validateNoSource,
      messageTemplate: ({ count = 0 }) =>
        isTranscription
          ? t('##count## submissions are missing audio file and will be ignored').replace('##count##', String(count))
          : t('##count## submissions are missing transcription and will be ignored').replace(
              '##count##',
              String(count),
            ),
    },
    {
      id: isTranscription ? 'already-transcribed' : 'already-translated',
      type: 'warning',
      priority: 5,
      validator: isTranscription ? validateAlreadyTranscribed : validateAlreadyTranslated,
      messageTemplate: (values) =>
        isTranscription
          ? t('##count## audio files totaling ##minutes## minutes already transcribed and will be ignored')
              .replace('##count##', String(values.count ?? 0))
              .replace('##minutes##', String(values.minutes ?? 0))
          : t('##count## transcripts totaling ##characters## characters already translated and will be ignored')
              .replace('##count##', String(values.count ?? 0))
              .replace('##characters##', String(values.characters ?? 0)),
    },
    {
      id: 'no-eligible-submissions',
      type: 'error',
      priority: 6,
      validator: validateNoEligibleSubmissions,
      messageTemplate: () => t('No submissions to process, see alerts above.'),
    },
  ]
}
