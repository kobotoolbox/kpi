import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionSubmissionStatusResponseStatusEnum } from '#/api/models/bulkActionSubmissionStatusResponseStatusEnum'
import { buildSupplementalPath } from '#/components/processing/processingUtils'
import { SUPPLEMENTAL_DETAILS_PROP } from '#/constants'
import type { SubmissionResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'

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

export function isBulkProcessingCellInProgress(
  bulkActions: BulkActionResponse[],
  submission: SubmissionResponse,
  columnKey: string,
) {
  if (!columnKey.startsWith(SUPPLEMENTAL_DETAILS_PROP)) {
    return false
  }

  const submissionUuids = new Set(
    [removeDefaultUuidPrefix(submission._uuid), removeDefaultUuidPrefix(submission['meta/rootUuid'])].filter(Boolean),
  )

  return bulkActions.some((bulkAction) => {
    if (getBulkProcessingColumnKey(bulkAction) !== columnKey) {
      return false
    }

    // Treat both 'in_progress' and 'pending' as "Processing" to ensure the cell displays
    // "Processing" for jobs that are queued but not yet started, as well as those already in progress.
    return bulkAction.submission_statuses.some(
      (submissionStatus) =>
        (submissionStatus.status === BulkActionSubmissionStatusResponseStatusEnum.in_progress ||
          submissionStatus.status === BulkActionSubmissionStatusResponseStatusEnum.pending) &&
        submissionUuids.has(removeDefaultUuidPrefix(submissionStatus.uuid)),
    )
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

  const visibleSubmissionUuids = new Set<string>()
  visibleSubmissions.forEach((submission) => {
    visibleSubmissionUuids.add(removeDefaultUuidPrefix(submission._uuid))
    visibleSubmissionUuids.add(removeDefaultUuidPrefix(submission['meta/rootUuid']))
  })

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

/*
 * Formats seconds into a "<hours> hours, <minutes> minutes" structure, with "…" as a fallback
 */
export const formatTimeFromSeconds = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours && !minutes) {
    return t('##hours## hours').replace('##hours##', String(hours))
  } else if (hours && minutes) {
    return t('##hours## hours, ##minutes## minutes')
      .replace('##hours##', String(hours))
      .replace('##minutes##', String(minutes))
  } else if (!hours && minutes) {
    return t('##minutes## minutes').replace('##minutes##', String(minutes))
  } else if (!hours && !minutes) {
    return t('##seconds## seconds').replace('##seconds##', String(seconds))
  } else {
    // Fallback for typescript, should never happen.
    return '…'
  }
}
