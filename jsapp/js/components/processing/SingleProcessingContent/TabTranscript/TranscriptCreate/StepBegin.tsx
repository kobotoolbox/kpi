import React from 'react'

import cx from 'classnames'
import Button from '#/components/common/button'
import { userCan } from '#/components/permissions/utils'
import ConflictingOngoingJobAlert from '#/components/processing/common/ConflictingOngoingJobAlert'
import type { AssetResponse } from '#/dataInterface'
import bodyStyles from '../../../common/processingBody.module.scss'
import { getProcessedFileLabel, getQuestionType } from '../common/utils'

interface Props {
  asset: AssetResponse
  questionXpath: string
  hasConflictingOngoingJob: boolean
  onNext: () => void
}

export default function StepBegin({ onNext, asset, questionXpath, hasConflictingOngoingJob }: Props) {
  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepBegin)}>
      <header className={bodyStyles.header}>
        {t('This ##type## does not have a transcript yet').replace(
          '##type##',
          getProcessedFileLabel(getQuestionType(asset, questionXpath)),
        )}
      </header>

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
