import React from 'react'

import cx from 'classnames'
import Button from '#/components/common/button'
import bodyStyles from '#/components/processing/processingBody.module.scss'
import singleProcessingStore from '#/components/processing/singleProcessingStore'

export default function Foo() {
  function begin() {
    // Make an empty draft.
    singleProcessingStore.setTranslationDraft({})
  }

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepBegin)}>
      <header className={bodyStyles.header}>{t('This transcript does not have any translations yet')}</header>

      <Button
        type='primary'
        size='l'
        label={t('begin')}
        onClick={begin}
        isDisabled={singleProcessingStore.getTranscript() === undefined}
      />
    </div>
  )
}
