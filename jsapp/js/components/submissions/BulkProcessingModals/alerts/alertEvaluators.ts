import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { getSupplementalPathParts } from '#/components/processing/processingUtils'
import {
  getOngoingBulkActionSubmissionUuids,
  hasTranscribableAudio,
  hasTranscriptInAnyLanguage,
  hasTranslatableTranscript,
} from '#/components/submissions/bulkProcessingUtils'
import { hasUnacceptedAutomaticContent } from '#/components/submissions/submissionUtils'
import { getSubmissionRootUuid } from '#/utils'
import type { AlertEvaluationContext, AlertEvaluationResult } from './types'

/**
 * Checks if user has reached their quota limit (0 remaining)
 */
export function evaluateReachedLimit(context: AlertEvaluationContext): AlertEvaluationResult | null {
  const { actionType, serviceUsageData } = context

  // Can't evaluate without service usage data
  if (!serviceUsageData?.balances) {
    return null
  }

  // Check the appropriate balance based on action type
  const balance =
    actionType === 'transcript' ? serviceUsageData.balances.asr_seconds : serviceUsageData.balances.mt_characters

  const exceeded = balance?.exceeded || false
  if (!exceeded) {
    return null
  }

  return {
    type: 'error',
    filteredSubmissionUuids: [],
    computedValues: {},
  }
}

/**
 * Checks if remaining quota is less than required but greater than 0
 */
export function evaluateNearLimit(context: AlertEvaluationContext): AlertEvaluationResult | null {
  const { actionType, serviceUsageData, requiredAmount } = context

  if (!serviceUsageData?.balances || requiredAmount === undefined) {
    return null
  }

  if (requiredAmount <= 0) {
    return null
  }

  const balance =
    actionType === 'transcript' ? serviceUsageData.balances.asr_seconds : serviceUsageData.balances.mt_characters

  if (!balance) {
    return null
  }

  const remainingAmount = balance.balance_value

  // Don't show this alert if:
  // 1. remainingAmount <= 0 — no quota left (the reached-limit alert handles this, runs first)
  // 2. remainingAmount >= requiredAmount — enough quota to process everything
  //
  // Show only when 0 < remainingAmount < requiredAmount.
  // That's when you have some quota but not enough for all the submissions you selected.
  if (remainingAmount <= 0 || remainingAmount >= requiredAmount) {
    return null
  }

  const computedValues =
    actionType === 'transcript'
      ? {
          remainingSeconds: remainingAmount,
        }
      : {
          remainingCharacters: remainingAmount,
        }

  return {
    type: 'error',
    filteredSubmissionUuids: [],
    computedValues,
  }
}

/**
 * Checks if there are conflicting bulk actions in progress
 *
 * For transcription: checks for ongoing transcription jobs on the same field (write-locked output)
 * For translation: checks for:
 *   - Ongoing translation jobs on the same field AND same target language (write-locked output)
 *   - Ongoing transcription jobs on the input transcript field (write-locked input)
 */
export function evaluateConflictingJob(context: AlertEvaluationContext): AlertEvaluationResult | null {
  const { activeBulkActions, fieldXpath, actionType, submissions, selectedLanguage } = context

  // Filter to only ongoing jobs (pending or in_progress)
  const ongoingJobs = activeBulkActions.filter(
    (action) =>
      action.status === BulkActionResponseStatusEnum.pending ||
      action.status === BulkActionResponseStatusEnum.in_progress,
  )

  if (ongoingJobs.length === 0) {
    return null
  }

  // Find conflicting jobs based on action type
  let conflictingJobs
  if (actionType === 'transcript') {
    // For transcription: check for ongoing transcription jobs on the same field
    conflictingJobs = ongoingJobs.filter(
      (action) =>
        action.action_id === ActionIdEnum.automatic_google_transcription && action.question_xpath === fieldXpath,
    )
  } else {
    // For translation: check for ongoing jobs that would conflict
    conflictingJobs = ongoingJobs.filter((action) => {
      if (action.question_xpath !== fieldXpath) {
        return false
      }

      // Transcription jobs on the same field conflict (they write to the input transcript)
      if (action.action_id === ActionIdEnum.automatic_google_transcription) {
        return true
      }

      // Translation jobs only conflict if targeting the same language
      // (different languages write to different output fields: translation_en, translation_fr, etc.)
      if (action.action_id === ActionIdEnum.automatic_google_translation) {
        return action.params.language === selectedLanguage
      }

      return false
    })
  }

  if (conflictingJobs.length === 0) {
    return null
  }

  // Submissions a conflicting job already finished stay eligible for a new job,
  // so collect only the ones it is still working on.
  const conflictingUuids = new Set<string>()
  conflictingJobs.forEach((job) => {
    getOngoingBulkActionSubmissionUuids(job).forEach((uuid) => conflictingUuids.add(uuid))
  })

  // Job submission uuids are root uuids, so map before comparing.
  const filteredSubmissionUuids = submissions
    .map(getSubmissionRootUuid)
    .filter((submissionRootUuid) => conflictingUuids.has(submissionRootUuid))

  if (filteredSubmissionUuids.length === 0) {
    return null
  }

  return {
    type: 'warning',
    filteredSubmissionUuids,
    computedValues: {
      count: filteredSubmissionUuids.length,
      conflictingJobCount: conflictingJobs.length,
    },
  }
}

/**
 * Checks for submissions missing audio attachments (transcription)
 * or missing transcripts (translation)
 */
export function evaluateNoSource(context: AlertEvaluationContext): AlertEvaluationResult | null {
  const { submissions, fieldXpath, actionType, previouslyFilteredSubmissionUuids } = context

  const missingSource: string[] = []

  submissions.forEach((submission) => {
    // Skip if already filtered by previous evaluators
    if (previouslyFilteredSubmissionUuids.has(getSubmissionRootUuid(submission))) {
      return
    }

    // Both checks are shared with the ones gating the matching table header menu
    // items, so the menu and this alert can't disagree on what has a source.
    const hasSource =
      actionType === 'transcript'
        ? hasTranscribableAudio(submission, fieldXpath)
        : hasTranslatableTranscript(submission, fieldXpath)

    if (!hasSource) {
      missingSource.push(getSubmissionRootUuid(submission))
    }
  })

  if (missingSource.length === 0) {
    return null
  }

  return {
    type: 'warning',
    filteredSubmissionUuids: missingSource,
    computedValues: {
      count: missingSource.length,
    },
  }
}

/**
 * Checks for submissions with existing transcripts
 */
export function evaluateAlreadyTranscribed(context: AlertEvaluationContext): AlertEvaluationResult | null {
  const { submissions, fieldXpath, previouslyFilteredSubmissionUuids } = context

  const alreadyTranscribed: string[] = []

  submissions.forEach((submission) => {
    // Skip if already filtered by previous evaluators
    if (previouslyFilteredSubmissionUuids.has(getSubmissionRootUuid(submission))) {
      return
    }

    // Same check the transcription modal uses for its quota estimate, so the two
    // can't disagree on which rows get skipped.
    if (hasTranscriptInAnyLanguage(submission, fieldXpath)) {
      alreadyTranscribed.push(getSubmissionRootUuid(submission))
    }
  })

  if (alreadyTranscribed.length === 0) {
    return null
  }

  return {
    type: 'warning',
    filteredSubmissionUuids: alreadyTranscribed,
    // The exact duration (in minutes) is resolved in the transcription modal
    // with the audio-duration endpoint and replaces this placeholder value.
    computedValues: {
      count: alreadyTranscribed.length,
      duration: 0,
    },
  }
}

/**
 * Checks for submissions with existing translations in the selected language
 */
export function evaluateAlreadyTranslated(context: AlertEvaluationContext): AlertEvaluationResult | null {
  const { submissions, fieldXpath, selectedLanguage, previouslyFilteredSubmissionUuids } = context

  // Can't evaluate without a selected language
  if (!selectedLanguage) {
    return null
  }

  const { sourceRowPath } = getSupplementalPathParts(fieldXpath)

  // Find submissions that already have translations in the selected language
  const alreadyTranslated: string[] = []
  let totalCharacters = 0

  submissions.forEach((submission) => {
    // Skip if already filtered by previous evaluators
    if (previouslyFilteredSubmissionUuids.has(getSubmissionRootUuid(submission))) {
      return
    }

    // Check if translation exists for this field and language
    const supplementalDetails = submission._supplementalDetails?.[sourceRowPath]
    const translation = supplementalDetails?.translation?.[selectedLanguage]

    if (translation?.value) {
      alreadyTranslated.push(getSubmissionRootUuid(submission))
      totalCharacters += translation.value.length
    }
  })

  if (alreadyTranslated.length === 0) {
    return null
  }

  return {
    type: 'warning',
    filteredSubmissionUuids: alreadyTranslated,
    computedValues: {
      count: alreadyTranslated.length,
      characters: totalCharacters,
    },
  }
}

/**
 * Checks for submissions with nothing left to approve, either because they are
 * approved already or because there is no automatic content at all. The backend
 * skips both.
 *
 * Uses the same check as the `Approve all selected` menu item and the `Review`
 * button in a cell, so all three agree on what still needs approval.
 */
export function evaluateAlreadyApproved(context: AlertEvaluationContext): AlertEvaluationResult | null {
  const { submissions, fieldXpath, previouslyFilteredSubmissionUuids } = context

  const alreadyApproved: string[] = []

  submissions.forEach((submission) => {
    // Skip if already filtered by previous evaluators
    if (previouslyFilteredSubmissionUuids.has(getSubmissionRootUuid(submission))) {
      return
    }

    if (!hasUnacceptedAutomaticContent(submission, fieldXpath)) {
      alreadyApproved.push(getSubmissionRootUuid(submission))
    }
  })

  if (alreadyApproved.length === 0) {
    return null
  }

  return {
    type: 'warning',
    filteredSubmissionUuids: alreadyApproved,
    computedValues: {
      count: alreadyApproved.length,
    },
  }
}

/**
 * Checks if all submissions have been filtered out by previous evaluators
 */
export function evaluateNoEligibleSubmissions(context: AlertEvaluationContext): AlertEvaluationResult | null {
  const eligibleCount = context.submissions.length - context.previouslyFilteredSubmissionUuids.size

  if (eligibleCount > 0) {
    return null
  }

  return {
    type: 'error',
    filteredSubmissionUuids: [],
    computedValues: {
      totalCount: context.submissions.length,
      filteredCount: context.previouslyFilteredSubmissionUuids.size,
    },
  }
}
