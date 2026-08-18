import React from 'react'
import Button from '#/components/common/button'

interface SubmissionEditButtonProps {
  isDisabled: boolean
  /** While Enketo is being opened in another tab. */
  isPending: boolean
  onClick: () => void
}

/**
 * Opens the record for editing in Enketo. Its own component because both the
 * actions row and the duplicate banner offer it.
 */
export default function SubmissionEditButton({ isDisabled, isPending, onClick }: SubmissionEditButtonProps) {
  return (
    <Button onClick={onClick} type='primary' size='l' isDisabled={isDisabled} isPending={isPending} label={t('Edit')} />
  )
}
