import React from 'react';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import {AsyncLanguageDisplayLabel} from 'js/components/languages/languagesUtils';
import TransxDate from 'js/components/processing/transxDate.component';
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

  return (
    <React.Fragment>
      <label className={bodyStyles.transxHeaderLanguage}>
        <AsyncLanguageDisplayLabel code={valueLanguageCode} />
      </label>

      <TransxDate
        dateCreated={storeTranscript?.dateCreated}
        dateModified={storeTranscript?.dateModified}
      />
    </React.Fragment>
  );
}
