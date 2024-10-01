import React from 'react';
import cx from 'classnames';
import Button from 'js/components/common/button';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import bodyStyles from 'js/components/processing/processingBody.module.scss';

export default function Foo() {
  function begin() {
    // Make an empty draft.
    singleProcessingStore.setTranslationDraft({});
  }

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepBegin)}>
      <header className={bodyStyles.header}>
        {t('This transcript does not have any translations yet')}
      </header>

      <Button
        type='primary'
        size='l'
        label={t('begin')}
        onClick={begin}
        isDisabled={singleProcessingStore.getTranscript() === undefined}
      />
    </div>
  );
}
