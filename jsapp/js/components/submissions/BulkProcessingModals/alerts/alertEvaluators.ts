import { getSupplementalPathParts } from '#/components/processing/processingUtils'
import type { AlertEvaluationContext, AlertEvaluationResult } from './types'
import { createInactiveResult } from './utils'

/**
 * Checks if user has reached their quota limit (0 remaining)
 */
export function evaluateReachedLimit(context: AlertEvaluationContext): AlertEvaluationResult {
  const { actionType, serviceUsageData } = context

  // Can't evaluate without service usage data
  if (!serviceUsageData?.balances) {
    return createInactiveResult('error')
  }

  // Check the appropriate balance based on action type
  const balance =
    actionType === 'transcript' ? serviceUsageData.balances.asr_seconds : serviceUsageData.balances.mt_characters

  return {
    shouldShow: balance?.exceeded || false,
    type: 'error',
    filteredSubmissionUuids: [],
    computedValues: {},
  }
}

/**
 * Checks if remaining quota is less than required but greater than 0
 * TODO: DEV-1399 - Implement this evaluator (depends on DEV-2255 for audio duration)
 */
export function evaluateNearLimit(context: AlertEvaluationContext): AlertEvaluationResult {
  console.log('[BulkProcessingAlerts] Evaluator evaluateNearLimit - STUBBED, returning no alerts', context)

  // STUB: Return inactive result
  return createInactiveResult('error')
}

/**
 * Checks if there are conflicting bulk actions in progress
 * TODO: DEV-1405 - Implement this evaluator
 */
export function evaluateConflictingJob(context: AlertEvaluationContext): AlertEvaluationResult {
  console.log('[BulkProcessingAlerts] Evaluator evaluateConflictingJob - STUBBED, returning no alerts', context)

  // STUB: Return inactive result
  return createInactiveResult('warning')
}

/**
 * Checks for submissions missing audio attachments (transcription)
 * or missing transcripts (translation)
 */
export function evaluateNoSource(context: AlertEvaluationContext): AlertEvaluationResult {
  const { submissions, fieldXpath, actionType, previouslyFilteredSubmissionUuids } = context

  const missingSource: string[] = []

  submissions.forEach((submission) => {
    // Skip if already filtered by previous evaluators
    if (previouslyFilteredSubmissionUuids.has(submission._uuid)) {
      return
    }

    let hasSource = false

    if (actionType === 'transcript') {
      // For transcription: check if there's an audio attachment for this field
      hasSource =
        submission._attachments?.some(
          (attachment) => attachment.question_xpath === fieldXpath && !attachment.is_deleted,
        ) ?? false
    } else {
      // For translation: check if there's a transcript
      // Note 1: we assume here that there can be only one transcript
      // Note 2: `fieldXpath` can be question xpath for transcript case, but for translation case it would be path to
      // supplementalDetails, but we need to compare it to question xpath, so we use utility function
      const { sourceRowPath } = getSupplementalPathParts(fieldXpath)
      const transcript = submission._supplementalDetails?.[sourceRowPath]?.transcript
      hasSource = Boolean(transcript?.value)
    }

    if (!hasSource) {
      missingSource.push(submission._uuid)
    }
  })

  return {
    shouldShow: missingSource.length > 0,
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
export function evaluateAlreadyTranscribed(context: AlertEvaluationContext): AlertEvaluationResult {
  const { submissions, fieldXpath, previouslyFilteredSubmissionUuids } = context

  const { sourceRowPath } = getSupplementalPathParts(fieldXpath)
  const alreadyTranscribed: string[] = []

  submissions.forEach((submission) => {
    // Skip if already filtered by previous evaluators
    if (previouslyFilteredSubmissionUuids.has(submission._uuid)) {
      return
    }

    const transcript = submission._supplementalDetails?.[sourceRowPath]?.transcript
    const hasTranscript = Boolean(transcript?.value || transcript?.pendingReview)

    if (hasTranscript) {
      alreadyTranscribed.push(submission._uuid)
    }
  })

  return {
    shouldShow: alreadyTranscribed.length > 0,
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
export function evaluateAlreadyTranslated(context: AlertEvaluationContext): AlertEvaluationResult {
  const { submissions, fieldXpath, selectedLanguage, previouslyFilteredSubmissionUuids } = context

  // Can't evaluate without a selected language
  if (!selectedLanguage) {
    return createInactiveResult('warning')
  }

  const { sourceRowPath } = getSupplementalPathParts(fieldXpath)

  // Find submissions that already have translations in the selected language
  const alreadyTranslated: string[] = []
  let totalCharacters = 0

  submissions.forEach((submission) => {
    // Skip if already filtered by previous evaluators
    if (previouslyFilteredSubmissionUuids.has(submission._uuid)) {
      return
    }

    // Check if translation exists for this field and language
    const supplementalDetails = submission._supplementalDetails?.[sourceRowPath]
    const translation = supplementalDetails?.translation?.[selectedLanguage]

    if (translation?.value) {
      alreadyTranslated.push(submission._uuid)
      totalCharacters += translation.value.length
    }
  })

  return {
    shouldShow: alreadyTranslated.length > 0,
    type: 'warning',
    filteredSubmissionUuids: alreadyTranslated,
    computedValues: {
      count: alreadyTranslated.length,
      characters: totalCharacters,
    },
  }
}

/**
 * Checks if all submissions have been filtered out by previous evaluators
 */
export function evaluateNoEligibleSubmissions(context: AlertEvaluationContext): AlertEvaluationResult {
  const eligibleCount = context.submissions.length - context.previouslyFilteredSubmissionUuids.size
  return {
    shouldShow: eligibleCount === 0,
    type: 'error',
    filteredSubmissionUuids: [],
    computedValues: {
      totalCount: context.submissions.length,
      filteredCount: context.previouslyFilteredSubmissionUuids.size,
    },
  }
}
