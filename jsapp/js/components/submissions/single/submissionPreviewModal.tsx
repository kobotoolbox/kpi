import React from 'react'
import type { AssetResponse } from '#/dataInterface'
import SubmissionDetails from './submissionDetails'
import SubmissionModalLayout from './submissionModalLayout'
import SubmissionRecordPlaceholder from './submissionRecordPlaceholder'
import { useSubmissionRecord } from './useSubmissionRecord'

interface SubmissionPreviewModalProps {
  asset: AssetResponse
  /** The record to show: `meta/rootUuid` (preferably) or `_id`. */
  submissionId: string
  onClose: () => void
  /** Leaves for the record's own address, where the rest of the features live. */
  onOpenFullRecord: () => void
  /** The record has been deleted, so there is nothing left to show. */
  onDeleted: () => void
}

/**
 * One submission, read without leaving the screen it was opened from - the map
 * above all, where changing page on every click makes browsing the points hard.
 *
 * Deliberately less than the record's own route: no stepping between records and
 * no duplicating. "Open full record" leads to the route for all of it.
 */
export default function SubmissionPreviewModal({
  asset,
  submissionId,
  onClose,
  onOpenFullRecord,
  onDeleted,
}: SubmissionPreviewModalProps) {
  const { isPending, isError, record, refresh } = useSubmissionRecord(asset.uid, submissionId)

  return (
    <SubmissionModalLayout
      title={t('Submission Record')}
      onClose={onClose}
      onOpenFullRecord={record ? onOpenFullRecord : undefined}
    >
      {record ? (
        <SubmissionDetails
          // Remount on a different record, so its UI state starts clean.
          key={record._id}
          asset={asset}
          submission={record}
          isInModal
          onRefreshRequested={refresh}
          onDeleted={onDeleted}
          // Leaving out `onDuplicated` is what hides the Duplicate action.
        />
      ) : (
        <SubmissionRecordPlaceholder isPending={isPending} isError={isError} submissionId={submissionId} />
      )}
    </SubmissionModalLayout>
  )
}
