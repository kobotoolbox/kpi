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
