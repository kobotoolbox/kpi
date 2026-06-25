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
 * TODO: DEV-1404 - Implement this evaluator
 */
export function evaluateNoSource(context: AlertEvaluationContext): AlertEvaluationResult {
  console.log('[BulkProcessingAlerts] Evaluator evaluateNoSource - STUBBED, returning no alerts', context)

  // STUB: Return inactive result
  return createInactiveResult('warning')
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
