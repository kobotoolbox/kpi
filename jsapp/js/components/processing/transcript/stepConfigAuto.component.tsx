import React from 'react';
import cx from 'classnames';
import clonedeep from 'lodash.clonedeep';
import Button from 'js/components/common/button';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import RegionSelector from 'js/components/languages/regionSelector';
import bodyStyles from 'js/components/processing/processingBody.module.scss';

export default function StepConfigAuto() {
  /** Changes the draft region, preserving the other draft properties. */
  function onRegionChange(newVal: LanguageCode | null | undefined) {
    const newDraft =
      clonedeep(singleProcessingStore.getTranscriptDraft()) || {};
    newDraft.regionCode = newVal;
    singleProcessingStore.setTranscriptDraft(newDraft);
  }

  /** Goes back from the automatic service configuration step. */
  function cancelAuto() {
    onRegionChange(undefined);
  }

  function requestAutoTranscription() {
    singleProcessingStore.requestAutoTranscription();
  }

  const draft = singleProcessingStore.getTranscriptDraft();

  if (draft?.languageCode === undefined) {
    return null;
  }

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
      <header className={bodyStyles.header}>
        {t('Automatic transcription of audio file from')}
      </header>

      <RegionSelector
        isDisabled={
          singleProcessingStore.data.isFetchingData ||
          singleProcessingStore.data.isPollingForTranscript
        }
        serviceCode='goog'
        serviceType='transcription'
        rootLanguage={draft.languageCode}
        onRegionChange={onRegionChange}
        onCancel={cancelAuto}
      />

      <h2>{t('Transcription provider')}</h2>

      <p>
        {t(
          'Automated transcription is provided by Google Cloud Platform. By ' +
            'using this service you agree that your audio file will be sent to ' +
            "Google's servers for the purpose of transcribing. However, it will " +
            "not be stored on Google's servers beyond the short period needed for " +
            'completing the transcription, and we do not allow Google to use the ' +
            'audio for improving its transcription service.'
        )}
      </p>

      <footer className={bodyStyles.footer}>
        <div className={bodyStyles.footerCenterButtons}>
          <Button
            type='frame'
            color='blue'
            size='m'
            label={t('cancel')}
            onClick={cancelAuto}
            isDisabled={
              singleProcessingStore.data.isFetchingData ||
              singleProcessingStore.data.isPollingForTranscript
            }
          />

          <Button
            type='full'
            color='blue'
            size='m'
            label={
              singleProcessingStore.data.isPollingForTranscript
                ? t('in progress')
                : t('create transcript')
            }
            onClick={requestAutoTranscription}
            isDisabled={
              singleProcessingStore.data.isFetchingData ||
              singleProcessingStore.data.isPollingForTranscript
            }
          />
        </div>
      </footer>
    </div>
  );
}
