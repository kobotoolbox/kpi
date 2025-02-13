import React, {useContext, useMemo, useState} from 'react';
import cx from 'classnames';
import clonedeep from 'lodash.clonedeep';
import Button from 'js/components/common/button';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import LanguageSelector, {
  resetAllLanguageSelectors,
} from 'js/components/languages/languageSelector';
import type {
  DetailedLanguage,
  ListLanguage,
} from 'js/components/languages/languagesStore';
import TransxAutomaticButton from 'js/components/processing/transxAutomaticButton';
import envStore from 'js/envStore';
import bodyStyles from 'js/components/processing/processingBody.module.scss';
import NlpUsageLimitBlockModal from '../nlpUsageLimitBlockModal/nlpUsageLimitBlockModal.component';
import {UsageLimitTypes} from 'js/account/stripe.types';
import {UsageContext} from 'js/account/usage/useUsage.hook';
import {useExceedingLimits} from 'js/components/usageLimits/useExceedingLimits.hook';

export default function StepConfig() {
  const [usage] = useContext(UsageContext);
  const limits = useExceedingLimits();
  const [isLimitBlockModalOpen, setIsLimitBlockModalOpen] =
    useState<boolean>(false);
  const isOverLimit = useMemo(() => {
    return limits.exceedList.includes(UsageLimitTypes.TRANSCRIPTION);
  }, [limits.exceedList]);

  function dismissLimitBlockModal() {
    setIsLimitBlockModalOpen(false);
  }
  /** Changes the draft value, preserving the other draft properties. */
  function setDraftValue(newVal: string | undefined) {
    const newDraft =
      clonedeep(singleProcessingStore.getTranscriptDraft()) || {};
    newDraft.value = newVal;
    singleProcessingStore.setTranscriptDraft(newDraft);
  }

  /** Changes the draft language, preserving the other draft properties. */
  function onLanguageChange(newVal: DetailedLanguage | ListLanguage | null) {
    const newDraft =
      clonedeep(singleProcessingStore.getTranscriptDraft()) || {};
    newDraft.languageCode = newVal?.code;
    singleProcessingStore.setTranscriptDraft(newDraft);
  }

  function back() {
    const draft = singleProcessingStore.getTranscriptDraft();
    if (
      draft !== undefined &&
      draft?.languageCode === undefined &&
      draft?.value === undefined
    ) {
      singleProcessingStore.safelyDeleteTranscriptDraft();
    }

    if (draft?.languageCode !== undefined && draft?.value === undefined) {
      singleProcessingStore.setTranslationDraft({});
      resetAllLanguageSelectors();
    }
  }

  function selectModeManual() {
    // Initialize draft value.
    setDraftValue('');
  }

  function selectModeAuto() {
    const newDraft =
      clonedeep(singleProcessingStore.getTranscriptDraft()) || {};
    // The `null` value tells us that no region was selected yet, but we are
    // interested in regions right now - i.e. when this property exists (is
    // defined) we show the automatic service configuration step.
    newDraft.regionCode = null;
    singleProcessingStore.setTranscriptDraft(newDraft);
  }

  function onAutomaticButtonClick() {
    if (isOverLimit) {
      setIsLimitBlockModalOpen(true);
    } else {
      selectModeAuto();
    }
  }

  const draft = singleProcessingStore.getTranscriptDraft();
  const languageSelectorTitle = t(
    'Please select the original language of the ##type##'
  ).replace('##type##', singleProcessingStore.getProcessedFileLabel());
  const isAutoEnabled = envStore.data.asr_mt_features_enabled;

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
      <LanguageSelector
        titleOverride={languageSelectorTitle}
        onLanguageChange={onLanguageChange}
        suggestedLanguages={singleProcessingStore.getAssetTranscriptableLanguages()}
      />

      <footer className={bodyStyles.footer}>
        <Button
          type='text'
          size='m'
          label={t('back')}
          startIcon='caret-left'
          onClick={back}
          isDisabled={singleProcessingStore.data.isFetchingData}
        />

        <div className={bodyStyles.footerRightButtons}>
          <Button
            type='secondary'
            size='m'
            label={isAutoEnabled ? t('manual') : t('transcribe')}
            onClick={selectModeManual}
            isDisabled={
              draft?.languageCode === undefined ||
              singleProcessingStore.data.isFetchingData
            }
          />

          <TransxAutomaticButton
            onClick={onAutomaticButtonClick}
            selectedLanguage={draft?.languageCode}
            type='transcript'
          />
          <NlpUsageLimitBlockModal
            isModalOpen={isLimitBlockModalOpen}
            usageType={UsageLimitTypes.TRANSCRIPTION}
            dismissed={dismissLimitBlockModal}
            interval={usage.trackingPeriod}
          />
        </div>
      </footer>
    </div>
  );
}
