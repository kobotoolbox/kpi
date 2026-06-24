import type { AlertValidationContext, AlertValidationResult } from './types'
import { createInactiveResult } from './utils'

/**
 * Checks if user has reached their quota limit (0 remaining)
 * TODO: DEV-1417 - Implement this validator
 */
export function validateReachedLimit(context: AlertValidationContext): AlertValidationResult {
  console.log('[BulkProcessingAlerts] Validator validateReachedLimit - STUBBED, returning no alerts', context)

  // STUB: Return inactive result
  return createInactiveResult('error')
}

/**
 * Checks if remaining quota is less than required but greater than 0
 * TODO: DEV-1399 - Implement this validator (depends on DEV-2255 for audio duration)
 */
export function validateNearLimit(context: AlertValidationContext): AlertValidationResult {
  console.log('[BulkProcessingAlerts] Validator validateNearLimit - STUBBED, returning no alerts', context)

  // STUB: Return inactive result
  return createInactiveResult('error')
}

/**
 * Checks if there are conflicting bulk actions in progress
 * TODO: DEV-1405 - Implement this validator
 */
export function validateConflictingJob(context: AlertValidationContext): AlertValidationResult {
  console.log('[BulkProcessingAlerts] Validator validateConflictingJob - STUBBED, returning no alerts', context)

  // STUB: Return inactive result
  return createInactiveResult('warning')
}

/**
 * Checks for submissions missing audio attachments (transcription)
 * or missing transcripts (translation)
 * TODO: DEV-1404 - Implement this validator
 */
export function validateNoSource(context: AlertValidationContext): AlertValidationResult {
  console.log('[BulkProcessingAlerts] Validator validateNoSource - STUBBED, returning no alerts', context)

  // STUB: Return inactive result
  return createInactiveResult('warning')
}

/**
 * Checks for submissions with existing transcripts
 * TODO: DEV-1410 - Implement this validator (full duration calc depends on DEV-2255)
 */
export function validateAlreadyTranscribed(context: AlertValidationContext): AlertValidationResult {
  console.log('[BulkProcessingAlerts] Validator validateAlreadyTranscribed - STUBBED, returning no alerts', context)

  // STUB: Return inactive result
  return createInactiveResult('warning')
}

/**
 * Checks for submissions with existing translations in the selected language
 * TODO: DEV-1403 - Implement this validator
 */
export function validateAlreadyTranslated(context: AlertValidationContext): AlertValidationResult {
  console.log('[BulkProcessingAlerts] Validator validateAlreadyTranslated - STUBBED, returning no alerts', context)

  // STUB: Return inactive result
  return createInactiveResult('warning')
}

/**
 * Checks if all submissions have been filtered out by previous validators
 */
export function validateNoEligibleSubmissions(context: AlertValidationContext): AlertValidationResult {
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
