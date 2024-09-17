import React, {useState, useEffect} from 'react';
import cx from 'classnames';
import clonedeep from 'lodash.clonedeep';
import Button from 'js/components/common/button';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import RegionSelector from 'js/components/languages/regionSelector';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import bodyStyles from 'js/components/processing/processingBody.module.scss';
import {
  getAttachmentForProcessing,
  secondsToTranscriptionEstimate,
} from 'js/components/processing/transcript/transcript.utils';
import assetStore from 'js/assetStore';
import {getAudioDuration} from 'js/utils';

/** Until the estimate is loaded we display dot dot dot. */
const NO_ESTIMATED_MINUTES = '…';

export default function StepConfigAuto() {
  const [estimate, setEstimate] = useState<string>(NO_ESTIMATED_MINUTES);

  // When polling for transcript, we need to calculate the estimated time
  useEffect(() => {
    if (singleProcessingStore.data.isPollingForTranscript) {
      const asset = assetStore.getAsset(singleProcessingStore.currentAssetUid);
      if (asset?.content) {
        const attachment = getAttachmentForProcessing(asset.content);
        if (typeof attachment !== 'string') {
          getAudioDuration(attachment.download_url).then((length: number) => {
            setEstimate(secondsToTranscriptionEstimate(length));
          });
        }
      }
    } else {
      setEstimate(NO_ESTIMATED_MINUTES);
    }
  }, [singleProcessingStore.data.isPollingForTranscript]);

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

  if (singleProcessingStore.data.isPollingForTranscript) {
    return (
      <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
        <LoadingSpinner type='big' message={false} />

        <header className={bodyStyles.header}>
          {t('Automatic transcription in progress')}
        </header>

        <p>
          {t('Estimated time for completion: ##estimate##').replace(
            '##estimate##',
            estimate
          )}
        </p>
      </div>
    );
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
            type='secondary'
            size='m'
            label={t('cancel')}
            onClick={cancelAuto}
            isDisabled={singleProcessingStore.data.isFetchingData}
          />

          <Button
            type='primary'
            size='m'
            label={t('create transcript')}
            onClick={requestAutoTranscription}
            isDisabled={singleProcessingStore.data.isFetchingData}
          />
        </div>
      </footer>
    </div>
  );
}
