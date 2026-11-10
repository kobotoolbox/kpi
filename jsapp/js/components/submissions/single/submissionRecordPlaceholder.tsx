import React from 'react'
import CenteredMessage from '#/components/common/centeredMessage.component'
import LoadingSpinner from '#/components/common/loadingSpinner'

interface SubmissionRecordPlaceholderProps {
  isPending: boolean
  isError: boolean
  /** Shown to the user, as it is the only thing we know about a record we cannot find. */
  submissionId: string
}

/**
 * What goes where the record would be when there is none to show. Shared by the
 * record's route and the preview modal, so both read the same.
 */
export default function SubmissionRecordPlaceholder({
  isPending,
  isError,
  submissionId,
}: SubmissionRecordPlaceholderProps) {
  if (isPending) {
    return <LoadingSpinner />
  }

  if (isError) {
    return <CenteredMessage message={t('Error: could not load data.')} />
  }

  // Not an error - a link can outlive the record it points at.
  return (
    <CenteredMessage
      message={t('The submission could not be found. It may have been deleted. Submission ID: ##id##').replace(
        '##id##',
        submissionId,
      )}
    />
  )
}
