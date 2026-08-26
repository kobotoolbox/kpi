import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { isSubmissionOngoingInBulkAction } from '#/components/submissions/bulkProcessingUtils'

interface IsConflictingOngoingJobArgs {
  activeBulkActions: BulkActionResponse[]
  actionType: 'transcript' | 'translation'
  fieldXpath: string
  /** Must come from `getSubmissionRootUuid`; a raw `_uuid` won't match an edited submission's job. */
  submissionUuid: string
  selectedLanguage?: LanguageCode
}

/**
 * Checks whether given job writes to the text we're about to edit.
 *
 * Assumes the job was already matched to our question xpath by the caller.
 */
function isConflictingAction(
  action: BulkActionResponse,
  actionType: IsConflictingOngoingJobArgs['actionType'],
  selectedLanguage?: LanguageCode,
) {
  // A transcription job rewrites the transcript, which is both the text we edit
  // on the transcript tab and the source a translation gets made from.
  if (action.action_id === ActionIdEnum.automatic_google_transcription) {
    return true
  }

  if (action.action_id === ActionIdEnum.automatic_google_translation) {
    // A translation job reads the transcript, so it clashes with editing it.
    // For translations it clashes with the language it writes to, or with any of
    // them when the caller hasn't settled on a language yet.
    return actionType === 'transcript' || !selectedLanguage || action.params.language === selectedLanguage
  }

  return false
}

/**
 * Checks whether one submission should be considered locked by an active bulk job.
 *
 * A job locks a submission when it targets the same question, writes to the text
 * we want to edit (see `isConflictingAction`), and hasn't finished that
 * submission yet (see `isSubmissionOngoingInBulkAction`).
 */
export function isConflictingOngoingJobForSubmission(args: IsConflictingOngoingJobArgs) {
  const { activeBulkActions, actionType, fieldXpath, submissionUuid, selectedLanguage } = args

  if (!submissionUuid) {
    return false
  }

  return activeBulkActions.some((action) => {
    // Different question xpath means a different write target.
    if (action.question_xpath !== fieldXpath) {
      return false
    }

    if (!isConflictingAction(action, actionType, selectedLanguage)) {
      return false
    }

    return isSubmissionOngoingInBulkAction(action, submissionUuid)
  })
}
