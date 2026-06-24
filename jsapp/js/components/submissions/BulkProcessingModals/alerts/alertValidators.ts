import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
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
 *
 * For transcription: checks for ongoing transcription jobs on the same field (write-locked output)
 * For translation: checks for:
 *   - Ongoing translation jobs on the same field (write-locked output)
 *   - Ongoing transcription jobs on the input transcript field (write-locked input)
 */
export function validateConflictingJob(context: AlertValidationContext): AlertValidationResult {
  const { activeBulkActions, fieldXpath, actionType, submissions } = context

  // Filter to only ongoing jobs (pending or in_progress)
  const ongoingJobs = activeBulkActions.filter(
    (action) =>
      action.status === BulkActionResponseStatusEnum.pending ||
      action.status === BulkActionResponseStatusEnum.in_progress,
  )

  if (ongoingJobs.length === 0) {
    return {
      shouldShow: false,
      type: 'warning',
      filteredSubmissionUuids: [],
      computedValues: {},
    }
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
    // For translation: check for ongoing translation jobs on the same field
    // OR ongoing transcription jobs on the input field (since translation reads from transcripts)
    conflictingJobs = ongoingJobs.filter(
      (action) =>
        (action.action_id === ActionIdEnum.automatic_google_translation && action.question_xpath === fieldXpath) ||
        (action.action_id === ActionIdEnum.automatic_google_transcription && action.question_xpath === fieldXpath),
    )
  }

  if (conflictingJobs.length === 0) {
    return {
      shouldShow: false,
      type: 'warning',
      filteredSubmissionUuids: [],
      computedValues: {},
    }
  }

  // Collect all submission UUIDs from conflicting jobs
  const conflictingUuids = new Set<string>()
  conflictingJobs.forEach((job) => {
    job.submission_uuids.forEach((uuid) => conflictingUuids.add(uuid))
  })

  // Filter out submissions that are in conflicting jobs
  const filteredSubmissionUuids = submissions
    .filter((submission) => conflictingUuids.has(submission._uuid))
    .map((submission) => submission._uuid)

  const shouldShow = filteredSubmissionUuids.length > 0

  if (shouldShow) {
    console.info(
      `[BulkProcessingAlerts] Alert "conflicting-job": Found ${filteredSubmissionUuids.length} submissions with ongoing jobs`,
    )
  }

  return {
    shouldShow,
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
