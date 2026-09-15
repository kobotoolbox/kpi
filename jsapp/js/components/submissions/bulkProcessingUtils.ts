import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionSubmissionStatusResponseStatusEnum } from '#/api/models/bulkActionSubmissionStatusResponseStatusEnum'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { getBlockedTargetLanguages } from '#/components/processing/common/utils'
import { buildSupplementalPath, getSupplementalPathParts } from '#/components/processing/processingUtils'
import { SUPPLEMENTAL_DETAILS_PROP } from '#/constants'
import type { SubmissionResponse } from '#/dataInterface'
import { getSubmissionRootUuid, removeDefaultUuidPrefix } from '#/utils'

/**
 * Checks if given submission has an audio file that can be transcribed in given
 * audio question column.
 *
 * A deleted attachment is not a usable source, as all of its `*_url`s return 404.
 */
export function hasTranscribableAudio(submission: SubmissionResponse, fieldXpath: string): boolean {
  return Boolean(
    submission._attachments?.some((attachment) => attachment.question_xpath === fieldXpath && !attachment.is_deleted),
  )
}

/**
 * Checks if any of given submissions can be transcribed, i.e. if a bulk
 * transcription action would have anything to work with.
 */
export function hasAnyTranscribableAudio(submissions: SubmissionResponse[], fieldXpath: string): boolean {
  return submissions.some((submission) => hasTranscribableAudio(submission, fieldXpath))
}

/**
 * Checks if given submission has a transcript that can be used as a source for
 * translation in given transcript column.
 *
 * A transcript awaiting approval has no `value` (the backend sends `pendingReview`
 * instead), so it can't be translated yet. One in another language belongs to a
 * different column: a question holds a single transcript, and it only shows up in
 * the column matching its language, so the cell is empty here.
 */
export function hasTranslatableTranscript(submission: SubmissionResponse, fieldXpath: string): boolean {
  // `fieldXpath` of a transcript column is a supplemental details path, but
  // `_supplementalDetails` is keyed by question xpath, so we need to convert it.
  const { sourceRowPath, languageCode } = getSupplementalPathParts(fieldXpath)
  const transcript = submission._supplementalDetails?.[sourceRowPath]?.transcript

  if (!transcript?.value) {
    return false
  }

  return transcript.languageCode === languageCode
}

/**
 * Checks if any of given submissions can be translated, i.e. if a bulk
 * translation action would have anything to work with.
 */
export function hasAnyTranslatableTranscript(submissions: SubmissionResponse[], fieldXpath: string): boolean {
  return submissions.some((submission) => hasTranslatableTranscript(submission, fieldXpath))
}

/**
 * Checks if given submission already has a transcript that a new bulk
 * transcription would overwrite.
 *
 * Unlike `hasTranslatableTranscript` above, the language is ignored on purpose:
 * a question holds a single transcript, so a French one would be replaced by an
 * English transcription just the same.
 *
 * A transcript awaiting approval counts too. It has no `value` yet (the backend
 * sends `pendingReview` instead), but it would still be lost.
 */
export function hasTranscriptInAnyLanguage(submission: SubmissionResponse, fieldXpath: string): boolean {
  const { sourceRowPath } = getSupplementalPathParts(fieldXpath)
  const transcript = submission._supplementalDetails?.[sourceRowPath]?.transcript

  return Boolean(transcript?.value || transcript?.pendingReview)
}

/**
 * Gets languages the user shouldn't be able to pick when bulk translating given transcript column.
 * Translating a transcript into its own language leaves an empty column that can't be deleted, so the column's language
 * is always blocked.
 * Rows this column can't translate from are ignored, as they get dropped before the action runs anyway.
 */
export function getBlockedBulkTranslationLanguages(
  submissions: SubmissionResponse[],
  fieldXpath: string,
): LanguageCode[] {
  const { sourceRowPath, languageCode: columnLanguage } = getSupplementalPathParts(fieldXpath)
  const languages = new Set<LanguageCode>(columnLanguage ? [columnLanguage] : [])

  // Scanning the rows catches `regionCode`, the transcript's locale. The back end translates from the locale whenever
  // there is one, without checking it against the language, so an `es` transcript with an `fr-CA` locale really would
  // be translated from French.
  submissions
    .filter((submission) => hasTranslatableTranscript(submission, fieldXpath))
    .forEach((submission) => {
      const transcript = submission._supplementalDetails?.[sourceRowPath]?.transcript
      if (transcript?.languageCode) {
        getBlockedTargetLanguages(transcript.languageCode, transcript.regionCode).forEach((language) =>
          languages.add(language),
        )
      }
    })

  return [...languages]
}

export function getBulkProcessingColumnKey(bulkAction: BulkActionResponse) {
  if (bulkAction.action_id === ActionIdEnum.automatic_google_transcription) {
    const sourceRowPath = bulkAction.question_xpath
    return buildSupplementalPath({
      sourceRowPath,
      type: 'transcript',
      languageCode: bulkAction.params.language,
    })
  } else if (bulkAction.action_id === ActionIdEnum.automatic_google_translation) {
    const sourceRowPath = bulkAction.question_xpath
    return buildSupplementalPath({
      sourceRowPath,
      type: 'translation',
      languageCode: bulkAction.params.language,
    })
  }
  return null
}

// A queued submission is not done yet, so it counts as ongoing too.
const ONGOING_SUBMISSION_STATUSES: BulkActionSubmissionStatusResponseStatusEnum[] = [
  BulkActionSubmissionStatusResponseStatusEnum.pending,
  BulkActionSubmissionStatusResponseStatusEnum.in_progress,
]

/**
 * Returns uuids of the submissions given bulk action hasn't finished yet.
 *
 * A bulk action has two kinds of status: its own, and one per submission. The
 * job stays `in_progress` until the slowest submission finishes, so only the
 * per-submission status tells you if a given submission is still being worked on.
 */
export function getOngoingBulkActionSubmissionUuids(bulkAction: BulkActionResponse): string[] {
  return bulkAction.submission_statuses
    .filter((submissionStatus) => ONGOING_SUBMISSION_STATUSES.includes(submissionStatus.status))
    .map((submissionStatus) => removeDefaultUuidPrefix(submissionStatus.uuid))
}

/**
 * Checks if this bulk action is still processing given submission.
 *
 * @param submissionRootUuid - From `getSubmissionRootUuid`. Prefixed or not, both work.
 */
export function isSubmissionOngoingInBulkAction(bulkAction: BulkActionResponse, submissionRootUuid: string): boolean {
  const ongoingUuids = new Set(getOngoingBulkActionSubmissionUuids(bulkAction))
  return ongoingUuids.has(removeDefaultUuidPrefix(submissionRootUuid))
}

export function isBulkProcessingCellInProgress(
  bulkActions: BulkActionResponse[],
  submission: SubmissionResponse,
  columnKey: string,
) {
  if (!columnKey.startsWith(SUPPLEMENTAL_DETAILS_PROP)) {
    return false
  }

  return bulkActions.some((bulkAction) => {
    if (getBulkProcessingColumnKey(bulkAction) !== columnKey) {
      return false
    }

    return isSubmissionOngoingInBulkAction(bulkAction, getSubmissionRootUuid(submission))
  })
}

/**
 * Computes which visible submission uuids should be refreshed when the active
 * bulk-actions snapshot changes.
 *
 * Rules implemented:
 * - refresh a visible row when its per-submission status transitions to `complete`
 * - when an action disappears from active list (job became terminal), refresh
 *   all still-visible rows that were `pending`, `in_progress`, or `complete`
 */
export function getVisibleBulkProcessingSubmissionUuidsToRefresh(
  prevActiveBulkActions: BulkActionResponse[],
  nextActiveBulkActions: BulkActionResponse[],
  visibleSubmissions: SubmissionResponse[],
): string[] {
  if (visibleSubmissions.length === 0) {
    return []
  }

  const previousActionsByUid = new Map(prevActiveBulkActions.map((bulkAction) => [bulkAction.uid, bulkAction]))

  const visibleSubmissionUuids = new Set(visibleSubmissions.map(getSubmissionRootUuid))

  const uuidsToRefresh = new Set<string>()

  nextActiveBulkActions.forEach((bulkAction) => {
    const previousBulkAction = previousActionsByUid.get(bulkAction.uid)
    const previousStatuses = new Map(
      (previousBulkAction?.submission_statuses || []).map((submissionStatus) => [
        removeDefaultUuidPrefix(submissionStatus.uuid),
        submissionStatus.status,
      ]),
    )

    bulkAction.submission_statuses.forEach((submissionStatus) => {
      const submissionUuid = removeDefaultUuidPrefix(submissionStatus.uuid)
      const previousStatus = previousStatuses.get(submissionUuid)

      if (
        submissionStatus.status === BulkActionSubmissionStatusResponseStatusEnum.complete &&
        previousStatus !== BulkActionSubmissionStatusResponseStatusEnum.complete
      ) {
        uuidsToRefresh.add(submissionUuid)
      }
    })

    previousActionsByUid.delete(bulkAction.uid)
  })

  previousActionsByUid.forEach((bulkAction) => {
    bulkAction.submission_statuses.forEach((submissionStatus) => {
      if (
        submissionStatus.status === BulkActionSubmissionStatusResponseStatusEnum.pending ||
        submissionStatus.status === BulkActionSubmissionStatusResponseStatusEnum.in_progress ||
        submissionStatus.status === BulkActionSubmissionStatusResponseStatusEnum.complete
      ) {
        uuidsToRefresh.add(removeDefaultUuidPrefix(submissionStatus.uuid))
      }
    })
  })

  return [...uuidsToRefresh].filter((submissionUuid) => visibleSubmissionUuids.has(submissionUuid))
}
