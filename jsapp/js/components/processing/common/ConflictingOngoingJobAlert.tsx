import React from 'react'
import Alert from '#/components/common/alert'
import type { AlertProps } from '#/components/common/alert'

interface Props extends Omit<AlertProps, 'type' | 'iconName'> {}

/**
 * Shared warning shown when the current submission is locked by an ongoing
 * conflicting bulk NLP job.
 *
 * Pass `children` to override the message on screens where nothing is being
 * blocked and the point is merely to explain what is happening.
 */
export default function ConflictingOngoingJobAlert({ children, ...props }: Props) {
  return (
    <Alert type='warning' iconName='warning' {...props}>
      {children ?? t('This submission is already being processed by another job.')}
    </Alert>
  )
}
