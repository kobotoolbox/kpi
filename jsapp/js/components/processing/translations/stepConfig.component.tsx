import React, {useContext, useMemo, useState} from 'react';
import cx from 'classnames';
import clonedeep from 'lodash.clonedeep';
import Button from 'js/components/common/button';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import TransxAutomaticButton from 'js/components/processing/transxAutomaticButton';
import LanguageSelector, {
  resetAllLanguageSelectors,
} from 'js/components/languages/languageSelector';
import type {
  LanguageCode,
  DetailedLanguage,
  ListLanguage,
} from 'js/components/languages/languagesStore';
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
    return limits.exceedList.includes(UsageLimitTypes.TRANSLATION);
  }, [limits.exceedList]);

  function dismissLimitBlockModal() {
    setIsLimitBlockModalOpen(false);
  }
  /** Changes the draft value, preserving the other draft properties. */
  function setDraftValue(newVal: string | undefined) {
    const newDraft =
      clonedeep(singleProcessingStore.getTranslationDraft()) || {};
    newDraft.value = newVal;
    singleProcessingStore.setTranslationDraft(newDraft);
  }

  /** Changes the draft language, preserving the other draft properties. */
  function onLanguageChange(newVal: DetailedLanguage | ListLanguage | null) {
    const newDraft =
      clonedeep(singleProcessingStore.getTranslationDraft()) || {};
    newDraft.languageCode = newVal?.code;
    singleProcessingStore.setTranslationDraft(newDraft);
  }

  /** Returns languages of all translations */
  function getTranslationsLanguages() {
    const translations = singleProcessingStore.getTranslations();
    const languages: LanguageCode[] = [];
    translations.forEach((translation) => {
      languages.push(translation.languageCode);
    });
    return languages;
  }

  function back() {
    const draft = singleProcessingStore.getTranslationDraft();

    if (
      draft !== undefined &&
      draft?.languageCode === undefined &&
      draft?.value === undefined
    ) {
      singleProcessingStore.safelyDeleteTranslationDraft();
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
      clonedeep(singleProcessingStore.getTranslationDraft()) || {};
    // The `null` value tells us that no region was selected yet, but we are
    // interested in regions right now - i.e. when this property exists (is
    // defined) we show the automatic service configuration step.
    newDraft.regionCode = null;
    singleProcessingStore.setTranslationDraft(newDraft);
  }

  function onAutomaticButtonClick() {
    if (isOverLimit) {
      setIsLimitBlockModalOpen(true);
    } else {
      selectModeAuto();
    }
  }

  const draft = singleProcessingStore.getTranslationDraft();
  const isAutoEnabled = envStore.data.asr_mt_features_enabled;

  return (
    <div className={cx(bodyStyles.root, bodyStyles.stepConfig)}>
      <LanguageSelector
        titleOverride={t('Please select the language you want to translate to')}
        onLanguageChange={onLanguageChange}
        hiddenLanguages={getTranslationsLanguages()}
        suggestedLanguages={singleProcessingStore.getAssetTranslatableLanguages()}
        isDisabled={singleProcessingStore.data.isFetchingData}
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
            label={isAutoEnabled ? t('manual') : t('translate')}
            onClick={selectModeManual}
            isDisabled={
              draft?.languageCode === undefined ||
              singleProcessingStore.data.isFetchingData
            }
          />

          <TransxAutomaticButton
            onClick={onAutomaticButtonClick}
            selectedLanguage={draft?.languageCode}
            type='translation'
          />
          <NlpUsageLimitBlockModal
            isModalOpen={isLimitBlockModalOpen}
            usageType={UsageLimitTypes.TRANSLATION}
            dismissed={dismissLimitBlockModal}
            interval={usage.trackingPeriod}
          />
        </div>
      </footer>
    </div>
  );
}
