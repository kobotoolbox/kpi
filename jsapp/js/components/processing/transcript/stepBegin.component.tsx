import React from 'react'

import cx from 'classnames'
import Button from '#/components/common/button'
import bodyStyles from '#/components/processing/processingBody.module.scss'
import singleProcessingStore from '#/components/processing/singleProcessingStore'
import { hasManagePermissionsToCurrentAsset } from '../analysis/utils'

export default function StepBegin() {
  function begin() {
    // Make an empty draft.
    singleProcessingStore.setTranscriptDraft({})
  }

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
        onClick={begin}
        isDisabled={!hasManagePermissionsToCurrentAsset()}
      />
    </div>
  )
}
