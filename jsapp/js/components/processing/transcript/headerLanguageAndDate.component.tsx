import React from 'react'

import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import bodyStyles from '#/components/processing/processingBody.module.scss'
import singleProcessingStore from '#/components/processing/singleProcessingStore'
import TransxDate from '#/components/processing/transxDate.component'

/** We have this as separate component, because we use it in two places. */
export default function HeaderLanguageAndDate() {
  const storeTranscript = singleProcessingStore.getTranscript()
  const draft = singleProcessingStore.getTranscriptDraft()
  const valueLanguageCode = draft?.languageCode || storeTranscript?.languageCode
  if (valueLanguageCode === undefined) {
    return null
  }

  return (
    <React.Fragment>
      <label className={bodyStyles.transxHeaderLanguage}>
        <AsyncLanguageDisplayLabel code={valueLanguageCode} />
      </label>

      <TransxDate dateCreated={storeTranscript?.dateCreated} dateModified={storeTranscript?.dateModified} />
    </React.Fragment>
  )
}
