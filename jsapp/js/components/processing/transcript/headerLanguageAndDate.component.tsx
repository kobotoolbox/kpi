import React from 'react';
import {formatTime} from 'js/utils';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import {AsyncLanguageDisplayLabel} from 'js/components/languages/languagesUtils';
import bodyStyles from 'js/components/processing/processingBody.module.scss';

/** We have this as separate component, because we use it in two places. */
export default function HeaderLanguageAndDate() {
  const storeTranscript = singleProcessingStore.getTranscript();
  const draft = singleProcessingStore.getTranscriptDraft();
  const valueLanguageCode =
    draft?.languageCode || storeTranscript?.languageCode;
  if (valueLanguageCode === undefined) {
    return null;
  }

  let dateText = '';
  if (storeTranscript) {
    if (storeTranscript.dateCreated !== storeTranscript?.dateModified) {
      dateText = t('last modified ##date##').replace(
        '##date##',
        formatTime(storeTranscript.dateModified)
      );
    } else {
      dateText = t('created ##date##').replace(
        '##date##',
        formatTime(storeTranscript.dateCreated)
      );
    }
  }

  return (
    <React.Fragment>
      <label className={bodyStyles.transxHeaderLanguage}>
        <AsyncLanguageDisplayLabel code={valueLanguageCode} />
      </label>

      {dateText !== '' && (
        <time className={bodyStyles.transxHeaderDate}>{dateText}</time>
      )}
    </React.Fragment>
  );
}
