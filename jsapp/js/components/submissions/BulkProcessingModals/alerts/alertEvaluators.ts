import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
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
 */
export function evaluateNearLimit(context: AlertEvaluationContext): AlertEvaluationResult {
  const { actionType, serviceUsageData, nearLimitRequiredAmount } = context

  if (!serviceUsageData?.balances || nearLimitRequiredAmount === undefined) {
    return createInactiveResult('error')
  }

  if (nearLimitRequiredAmount <= 0) {
    return createInactiveResult('error')
  }

  const balance =
    actionType === 'transcript' ? serviceUsageData.balances.asr_seconds : serviceUsageData.balances.mt_characters

  if (!balance) {
    return createInactiveResult('error')
  }

  const remainingAmount = balance.balance_value

  // Don't show this alert if:
  // 1. remainingAmount <= 0 — no quota left (the reached-limit alert handles this, runs first)
  // 2. remainingAmount >= nearLimitRequiredAmount — enough quota to process everything
  //
  // Show only when 0 < remainingAmount < nearLimitRequiredAmount.
  // That's when you have some quota but not enough for all the submissions you selected.
  if (remainingAmount <= 0 || remainingAmount >= nearLimitRequiredAmount) {
    return createInactiveResult('error')
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
    shouldShow: true,
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
export function evaluateConflictingJob(context: AlertEvaluationContext): AlertEvaluationResult {
  const { activeBulkActions, fieldXpath, actionType, submissions, selectedLanguage } = context

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

  return {
    shouldShow: filteredSubmissionUuids.length > 0,
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
