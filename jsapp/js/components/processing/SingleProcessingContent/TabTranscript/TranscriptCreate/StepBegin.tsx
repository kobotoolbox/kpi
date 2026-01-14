import React from 'react'

import cx from 'classnames'
import assetStore from '#/assetStore'
import Button from '#/components/common/button'
import { userCan } from '#/components/permissions/utils'
import singleProcessingStore from '#/components/processing/singleProcessingStore'
import bodyStyles from '../../../common/processingBody.module.scss'

interface Props {
  assetUid: string
  onNext: () => void
}

export default function StepBegin({ onNext, assetUid }: Props) {
  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepBegin)}>
      <header className={bodyStyles.header}>
        {t('This ##type## does not have a transcript yet').replace(
          '##type##',
          singleProcessingStore.getProcessedFileLabel(),
        )}
      </header>

      <Button
        type='primary'
        size='l'
        label={t('begin')}
        onClick={onNext}
        isDisabled={!userCan('change_submissions', assetStore.getAsset(assetUid))}
      />
    </div>
  )
}
