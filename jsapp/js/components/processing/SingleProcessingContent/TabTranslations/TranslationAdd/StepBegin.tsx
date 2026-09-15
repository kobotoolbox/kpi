import React from 'react'

import cx from 'classnames'
import Button from '#/components/common/button'
import { userCan } from '#/components/permissions/utils'
import ConflictingOngoingJobAlert from '#/components/processing/common/ConflictingOngoingJobAlert'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../../common/processingBody.module.scss'

interface Props {
  asset: AssetResponse
  /**
   * Whether any job is running for this submission, since no target language is
   * picked at this step yet. We block "begin" rather than only warning: the job
   * may finish (or another may start) while the user is walking through the next
   * steps, so the language step's own check can't be the only guard.
   */
  hasConflictingOngoingJob: boolean
  onNext: () => void
}

export default function StepBegin({ asset, hasConflictingOngoingJob, onNext }: Props) {
  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepBegin)}>
      <header className={bodyStyles.header}>{t('This transcript does not have any translations yet')}</header>

      <Button
        type='primary'
        size='l'
        label={t('begin')}
        onClick={onNext}
        isDisabled={!userCan('change_submissions', asset) || hasConflictingOngoingJob}
      />

      {hasConflictingOngoingJob && <ConflictingOngoingJobAlert mt='md' />}
    </div>
  )
}
