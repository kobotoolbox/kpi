import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import type { DataResponse } from '#/api/models/dataResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { removeDefaultUuidPrefix } from '#/utils'

interface IsConflictingOngoingJobArgs {
  activeBulkActions: BulkActionResponse[]
  actionType: 'transcript' | 'translation'
  fieldXpath: string
  submissionUuid: string
  selectedLanguage?: LanguageCode
}

/**
 * For lock checks and supplement mutations we use the root UUID form. In this
 * code path `submission` is a `DataResponse`, so `meta/rootUuid` is required,
 * and this helper is just the single place where we strip its prefix.
 */
export function getSubmissionRootUuid(submission: DataResponse) {
  return removeDefaultUuidPrefix(submission['meta/rootUuid'])
}

// Pending and in-progress jobs can still write/update records, so only those
// states can block editing in Single Processing.
function isOngoingBulkAction(action: BulkActionResponse) {
  return (
    action.status === BulkActionResponseStatusEnum.pending || action.status === BulkActionResponseStatusEnum.in_progress
  )
}

/**
 * Checks whether one submission should be considered locked by an active bulk job.
 *
 * Transcript rule:
 * - Ongoing bulk transcription on the same question conflicts.
 * - Ongoing bulk translation on the same question also conflicts, because the
 *   transcript is the source text the translation job is reading from.
 *
 * Translation rules:
 * - Ongoing bulk transcription on the same question conflicts because transcript
 *   is the translation source and may still change.
 * - Ongoing bulk translation on the same question conflicts only when target
 *   language matches; different languages write to different destinations.
 */
export function isConflictingOngoingJobForSubmission(args: IsConflictingOngoingJobArgs) {
  const { activeBulkActions, actionType, fieldXpath, submissionUuid, selectedLanguage } = args

  if (!submissionUuid) {
    return false
  }

  if (actionType === 'translation' && !selectedLanguage) {
    return false
  }

  return activeBulkActions.filter(isOngoingBulkAction).some((action) => {
    // Different question xpath means a different write target.
    if (action.question_xpath !== fieldXpath) {
      return false
    }

    if (actionType === 'transcript') {
      return (
        (action.action_id === ActionIdEnum.automatic_google_transcription ||
          action.action_id === ActionIdEnum.automatic_google_translation) &&
        action.submission_uuids.includes(submissionUuid)
      )
    }

    if (action.action_id === ActionIdEnum.automatic_google_transcription) {
      // Translation depends on transcript content, so we treat active
      // transcript generation as a conflict here too.
      return action.submission_uuids.includes(submissionUuid)
    }

    if (action.action_id === ActionIdEnum.automatic_google_translation) {
      return action.params.language === selectedLanguage && action.submission_uuids.includes(submissionUuid)
    }

    return false
  })
}
