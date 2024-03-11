import React from 'react';
import {formatTime} from 'js/utils';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import {AsyncLanguageDisplayLabel} from 'js/components/languages/languagesUtils';
import TransxSelector from 'js/components/processing/transxSelector';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import bodyStyles from 'js/components/processing/processingBody.module.scss';

interface HeaderLanguageAndDateProps {
  /** Uses languageCode. */
  selectedTranslation?: LanguageCode;
  onRequestSelectTranslation: (
    newSelectedOption: LanguageCode | undefined
  ) => void;
}

export default function HeaderLanguageAndDate(
  props: HeaderLanguageAndDateProps
) {
  /** Renders a text or a selector of translations. */
  function renderLanguage() {
    const draft = singleProcessingStore.getTranslationDraft();

    // When editing we want to display just a text
    if (draft?.languageCode) {
      return (
        <label className={bodyStyles.transxHeaderLanguage}>
          <AsyncLanguageDisplayLabel code={draft.languageCode} />
        </label>
      );
    }

    const translations = singleProcessingStore.getTranslations();

    // When viewing the only translation we want to display just a text
    if (!draft && translations.length === 1) {
      return (
        <label className={bodyStyles.transxHeaderLanguage}>
          <AsyncLanguageDisplayLabel code={translations[0].languageCode} />
        </label>
      );
    }

    // When viewing one of translations we want to have an option to select some
    // other translation.
    if (!draft && translations.length >= 2) {
      return (
        <label className={bodyStyles.transxHeaderLanguage}>
          <TransxSelector
            languageCodes={translations.map(
              (translation) => translation.languageCode
            )}
            selectedLanguage={props.selectedTranslation}
            onChange={(newSelectedOption: LanguageCode | null) => {
              props.onRequestSelectTranslation(newSelectedOption || undefined);
            }}
            size='s'
            type='blue'
          />
        </label>
      );
    }

    return null;
  }

  const storeTranslation = singleProcessingStore.getTranslation(
    props.selectedTranslation
  );

  let dateText = '';
  if (storeTranslation) {
    if (storeTranslation.dateCreated !== storeTranslation?.dateModified) {
      dateText = t('last modified ##date##').replace(
        '##date##',
        formatTime(storeTranslation.dateModified)
      );
    } else {
      dateText = t('created ##date##').replace(
        '##date##',
        formatTime(storeTranslation.dateCreated)
      );
    }
  }

  return (
    <React.Fragment>
      {renderLanguage()}

      {dateText !== '' && (
        <time className={bodyStyles.transxHeaderDate}>{dateText}</time>
      )}
    </React.Fragment>
  );
}
