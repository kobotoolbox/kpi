import React from 'react'

import cx from 'classnames'
import Button from '#/components/common/button'
import { userCan } from '#/components/permissions/utils'
import ConflictingOngoingJobAlert from '#/components/processing/common/ConflictingOngoingJobAlert'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../../common/processingBody.module.scss'

interface Props {
  asset: AssetResponse
  /** Whether any translation job is running, since no language is picked yet here. */
  hasConflictingOngoingJob: boolean
  onNext: () => void
}

export default function StepBegin({ asset, hasConflictingOngoingJob, onNext }: Props) {
  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepBegin)}>
      <header className={bodyStyles.header}>{t('This transcript does not have any translations yet')}</header>

      {/*
        We only warn here, without blocking: a job translating to one language
        doesn't stop the user from adding another one. The language step checks
        the picked language and blocks that case.
      */}
      <Button
        type='primary'
        size='l'
        label={t('begin')}
        onClick={onNext}
        isDisabled={!userCan('change_submissions', asset)}
      />

      {hasConflictingOngoingJob && <ConflictingOngoingJobAlert mt='md' />}
    </div>
  )
}
