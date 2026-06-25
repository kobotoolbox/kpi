import { getSupplementalPathParts } from '#/components/processing/processingUtils'
import type { AlertEvaluationContext, AlertEvaluationResult } from './types'
import { createInactiveResult } from './utils'

/**
 * Checks if user has reached their quota limit (0 remaining)
 * TODO: DEV-1417 - Implement this evaluator
 */
export function evaluateReachedLimit(context: AlertEvaluationContext): AlertEvaluationResult {
  console.log('[BulkProcessingAlerts] Evaluator evaluateReachedLimit - STUBBED, returning no alerts', context)

  // STUB: Return inactive result
  return createInactiveResult('error')
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
 * TODO: DEV-1410 - Implement this evaluator (full duration calc depends on DEV-2255)
 */
export function evaluateAlreadyTranscribed(context: AlertEvaluationContext): AlertEvaluationResult {
  console.log('[BulkProcessingAlerts] Evaluator evaluateAlreadyTranscribed - STUBBED, returning no alerts', context)

  // STUB: Return inactive result
  return createInactiveResult('warning')
}

/**
 * Checks for submissions with existing translations in the selected language
 * TODO: DEV-1403 - Implement this evaluator
 */
export function evaluateAlreadyTranslated(context: AlertEvaluationContext): AlertEvaluationResult {
  console.log('[BulkProcessingAlerts] Evaluator evaluateAlreadyTranslated - STUBBED, returning no alerts', context)

  // STUB: Return inactive result
  return createInactiveResult('warning')
}

/**
 * Checks if all submissions have been filtered out by previous evaluators
 */
export function evaluateNoEligibleSubmissions(context: AlertEvaluationContext): AlertEvaluationResult {
  const eligibleCount = context.submissions.length - context.previouslyFilteredSubmissionUuids.size

  const shouldShow = eligibleCount === 0

  if (shouldShow) {
    console.info('[BulkProcessingAlerts] Alert "no-eligible-submissions": All submissions filtered out')
  }

  return {
    shouldShow,
    type: 'error',
    filteredSubmissionUuids: [],
    computedValues: {
      totalCount: context.submissions.length,
      filteredCount: context.previouslyFilteredSubmissionUuids.size,
    },
  }
}
