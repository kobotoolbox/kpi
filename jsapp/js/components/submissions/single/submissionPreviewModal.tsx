import { Group } from '@mantine/core'
import React from 'react'
import Button from '#/components/common/ButtonNew'
import ModalNew from '#/components/common/ModalNew'
import type { AssetResponse } from '#/dataInterface'
import SubmissionDetails from './submissionDetails'
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

  const renderInModal = (content: React.ReactNode) => (
    // A form's worth of answers needs the width, and Mantine keeps it inside the
    // viewport on smaller screens. Height takes care of itself: it caps at 90% of
    // the viewport and scrolls the body under a pinned header.
    <ModalNew opened onClose={onClose} title={t('Submission Record')} size={1240}>
      {content}
    </ModalNew>
  )

  if (!record) {
    return renderInModal(
      <SubmissionRecordPlaceholder isPending={isPending} isError={isError} submissionId={submissionId} />,
    )
  }

  return renderInModal(
    <>
      {/* Above the record, which is as long as the form - anything below it would
      be well out of sight. */}
      <Group justify='flex-end' mb='md'>
        <Button variant='light' size='md' rightIcon='angle-right' onClick={onOpenFullRecord}>
          {t('Open full record')}
        </Button>
      </Group>

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
    </>,
  )
}
