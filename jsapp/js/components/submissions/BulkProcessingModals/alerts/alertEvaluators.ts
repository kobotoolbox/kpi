import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
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
 *
 * For transcription: checks for ongoing transcription jobs on the same field (write-locked output)
 * For translation: checks for:
 *   - Ongoing translation jobs on the same field (write-locked output)
 *   - Ongoing transcription jobs on the input transcript field (write-locked input)
 */
export function evaluateConflictingJob(context: AlertEvaluationContext): AlertEvaluationResult {
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
    // For translation: check for ongoing jobs that would conflict
    conflictingJobs = ongoingJobs.filter((action) => {
      // Translation jobs have xpath that points to transcript inside `_supplementalDetails`.
      // Check if this translation job is for the same field
      if (action.action_id === ActionIdEnum.automatic_google_translation) {
        const pathParts = getSupplementalPathParts(action.question_xpath)
        return pathParts.sourceRowPath === fieldXpath && pathParts.type === 'transcript'
      }
      // Transcription jobs on the same field also conflict (they write to the input transcript)
      if (action.action_id === ActionIdEnum.automatic_google_transcription) {
        return action.question_xpath === fieldXpath
      }
      return false
    })
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
