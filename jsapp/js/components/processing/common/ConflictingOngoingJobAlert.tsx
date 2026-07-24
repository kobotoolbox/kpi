import React from 'react'
import Alert from '#/components/common/alert'
import type { AlertProps } from '#/components/common/alert'

interface Props extends Omit<AlertProps, 'type' | 'iconName' | 'children'> {}

/**
 * Shared warning shown when the current submission is locked by an ongoing
 * conflicting bulk NLP job.
 */
export default function ConflictingOngoingJobAlert(props: Props) {
  return (
    <Alert type='warning' iconName='warning' {...props}>
      {t('This submission is already being processed by another job.')}
    </Alert>
  )
}
