import React from 'react';
import cx from 'classnames';
import Button from 'js/components/common/button';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import bodyStyles from 'js/components/processing/processingBody.module.scss';
import {hasManagePermissionsToCurrentAsset} from '../analysis/utils';
import {QUESTION_TYPES} from 'jsapp/js/constants';

export default function StepBegin() {
  function begin() {
    // Make an empty draft.
    singleProcessingStore.setTranscriptDraft({});
  }

  let typeLabel = t('source file');
  if (singleProcessingStore.currentQuestionType === QUESTION_TYPES.audio.id) {
    typeLabel = QUESTION_TYPES.audio.label;
  } else if (singleProcessingStore.currentQuestionType === QUESTION_TYPES['background-audio'].id) {
    typeLabel = QUESTION_TYPES['background-audio'].label;
  }

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepBegin)}>
      <header className={bodyStyles.header}>
        {t('This ##type## does not have a transcript yet').replace(
          '##type##',
          // We change these to lowercase, as it makes more sense
          typeLabel.toLowerCase()
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
  );
}
