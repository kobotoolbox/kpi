import React from 'react';
import cx from 'classnames';
import clonedeep from 'lodash.clonedeep';
import Button from 'js/components/common/button';
import RegionSelector from 'js/components/languages/regionSelector';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import bodyStyles from 'js/components/processing/processingBody.module.scss';

export default function StepConfigAuto() {
  /** Changes the draft region, preserving the other draft properties. */
  function onRegionChange(newVal: LanguageCode | null | undefined) {
    const newDraft =
      clonedeep(singleProcessingStore.getTranslationDraft()) || {};
    newDraft.regionCode = newVal;
    singleProcessingStore.setTranslationDraft(newDraft);
  }

  /** Goes back from the automatic service configuration step. */
  function cancelAuto() {
    onRegionChange(undefined);
  }

  function requestAutoTranslation() {
    // Currently we only support automatic translation from transcript language,
    // but we should also allow to use the source data language.
    const toLanguageCode =
      singleProcessingStore.getTranslationDraft()?.regionCode ||
      singleProcessingStore.getTranslationDraft()?.languageCode;
    if (toLanguageCode) {
      singleProcessingStore.requestAutoTranslation(toLanguageCode);
    }
  }

  const draft = singleProcessingStore.getTranslationDraft();

  if (draft?.languageCode === undefined) {
    return null;
  }

  if (singleProcessingStore.data.isPollingForTranslation) {
    return (
      <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
        <LoadingSpinner type='big' message={false} />

        <header className={bodyStyles.header}>
          {t('Automatic translation in progress')}
        </header>

        {/*
        Automatic translation is much faster than automatic transcription, but
        for the consistency sake we use similar UI here.
        */}
        <p>
          {t('Estimated time for completion: ##estimate##').replace(
            '##estimate##',
            t('less than a minute')
          )}
        </p>
      </div>
    );
  }

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
      <header className={bodyStyles.header}>
        {t('Automatic translation of transcript to')}
      </header>

      <RegionSelector
        isDisabled={singleProcessingStore.data.isFetchingData}
        serviceCode='goog'
        serviceType='translation'
        rootLanguage={draft.languageCode}
        onRegionChange={onRegionChange}
        onCancel={cancelAuto}
      />

      <h2>{t('Translation provider')}</h2>

      <p>
        {t(
          'Automated translation is provided by Google Cloud Platform. By using ' +
            'this service you agree that your transcript text will be sent to ' +
            "Google's servers for the purpose of translation. However, it will not " +
            "be stored on Google's servers beyond the very short period needed for " +
            'completing the translation.'
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
            label={t('create translation')}
            onClick={requestAutoTranslation}
            isDisabled={singleProcessingStore.data.isFetchingData}
          />
        </div>
      </footer>
    </div>
  );
}
