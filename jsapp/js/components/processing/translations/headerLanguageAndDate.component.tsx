import React from 'react'

import type { LanguageCode } from '#/components/languages/languagesStore'
import { AsyncLanguageDisplayLabel } from '#/components/languages/languagesUtils'
import bodyStyles from '#/components/processing/processingBody.module.scss'
import singleProcessingStore from '#/components/processing/singleProcessingStore'
import TransxDate from '#/components/processing/transxDate.component'
import TransxSelector from '#/components/processing/transxSelector'

interface HeaderLanguageAndDateProps {
  /** Uses languageCode. */
  selectedTranslation?: LanguageCode
  onRequestSelectTranslation: (newSelectedOption: LanguageCode | undefined) => void
}

export default function HeaderLanguageAndDate(props: HeaderLanguageAndDateProps) {
  /** Renders a text or a selector of translations. */
  function renderLanguage() {
    const draft = singleProcessingStore.getTranslationDraft()

    // When editing we want to display just a text
    if (draft?.languageCode) {
      return (
        <label className={bodyStyles.transxHeaderLanguage}>
          <AsyncLanguageDisplayLabel code={draft.languageCode} />
        </label>
      )
    }

    const translations = singleProcessingStore.getTranslations()

    // When viewing the only translation we want to display just a text
    if (!draft && translations.length === 1) {
      return (
        <label className={bodyStyles.transxHeaderLanguage}>
          <AsyncLanguageDisplayLabel code={translations[0].languageCode} />
        </label>
      )
    }

    // When viewing one of translations we want to have an option to select some
    // other translation.
    if (!draft && translations.length >= 2) {
      return (
        <label className={bodyStyles.transxHeaderLanguage}>
          <TransxSelector
            languageCodes={translations.map((translation) => translation.languageCode)}
            selectedLanguage={props.selectedTranslation}
            onChange={(newSelectedOption: LanguageCode | null) => {
              props.onRequestSelectTranslation(newSelectedOption || undefined)
            }}
            size='s'
            type='blue'
          />
        </label>
      )
    }

    return null
  }

  const storeTranslation = singleProcessingStore.getTranslation(props.selectedTranslation)

  return (
    <React.Fragment>
      {renderLanguage()}

      <TransxDate dateCreated={storeTranslation?.dateCreated} dateModified={storeTranslation?.dateModified} />
    </React.Fragment>
  )
}
