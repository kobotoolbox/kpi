import React from 'react'

interface Props {
  questionUuid: string
  fields: unknown
  onFieldsChange: (fields: unknown) => void
}

/**
 * TBD
 */
export default function KeywordSearchFieldsEditor(_props: Props) {
  return null
  // const analysisQuestions = useContext(AnalysisQuestionsContext)
  // if (!analysisQuestions) {
  //   return null
  // }

  // /**
  //  * Does a little cleanup of tags:
  //  * 1. remove whitespace before and after the tag
  //  * 2. no duplicates (needed in addition to `onlyUnique` option on
  //  *    `<TagsInput>`, because of whitespace changes)
  //  */
  // function onKeywordsChange(newKeywords: string[]) {
  //   const cleanTags = Array.from(new Set(newKeywords.map((tag) => tag.trim())))

  //   props.onFieldsChange({
  //     ...props.fields,
  //     keywords: cleanTags,
  //   })
  // }

  // function onSourceChange(newSource: LanguageCode | null) {
  //   props.onFieldsChange({
  //     ...props.fields,
  //     source: newSource ? newSource : undefined,
  //   })
  // }

  // /**
  //  * Returns a list of selectable language codes.
  //  * Omits the one currently being edited.
  //  */
  // const languageCodes = (() => {
  //   const sources = []

  //   if (singleProcessingStore.data.transcript?.languageCode) {
  //     sources.push(singleProcessingStore.data.transcript?.languageCode)
  //   }

  //   singleProcessingStore.data.translations.forEach((translation: Transx) => {
  //     if (translation.languageCode !== singleProcessingStore.data.translationDraft?.languageCode) {
  //       // TODO: props.fields.source?
  //       sources.push(translation.languageCode)
  //     }
  //   })

  //   return sources
  // })()

  // const inputHtmlId = 'keywordSearchFieldsEditor_TagsInput_Input'

  // return (
  //   <section className={styles.root}>
  //     <section className={styles.left}>
  //       <label className={styles.sideLabel} htmlFor={inputHtmlId}>
  //         {t('Look for')}
  //       </label>

  //       {/*
  //         While doing https://github.com/kobotoolbox/kpi/issues/4594 ensure that
  //         a support article is written and a link updated here <3
  //       */}
  //       <a className={styles.helpLink} href={'#TODO'}>
  //         <Icon name={'information'} size='xs' />
  //         {t('help')}
  //       </a>

  //       <TagsInput
  //         value={props.fields.keywords || []}
  //         onChange={onKeywordsChange}
  //         inputProps={{
  //           id: inputHtmlId,
  //           placeholder: t('Type keywords'),
  //         }}
  //         onlyUnique
  //         addOnBlur
  //         addOnPaste
  //       />
  //     </section>

  //     <section className={styles.right}>
  //       <label className={styles.sideLabel}>{t('Search this transcript/translation:')}</label>

  //       <TransxSelector
  //         languageCodes={languageCodes}
  //         selectedLanguage={props.fields.source}
  //         onChange={onSourceChange}
  //         size='l'
  //         type='outline'
  //       />
  //     </section>
  //   </section>
  // )
}
