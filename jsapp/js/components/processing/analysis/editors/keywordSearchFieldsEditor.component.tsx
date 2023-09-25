import React, {useContext} from 'react';
import styles from './keywordSearchFieldsEditor.module.scss';
import TagsInput from 'react-tagsinput';
import Icon from 'js/components/common/icon';
import type {AdditionalFields} from 'js/components/processing/analysis/constants';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import TransxSelector from 'js/components/processing/transxSelector';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';

interface KeywordSearchFieldsEditorProps {
  questionUuid: string;
  fields: AdditionalFields;
  onFieldsChange: (fields: AdditionalFields) => void;
}

/**
 * TBD
 */
export default function KeywordSearchFieldsEditor(
  props: KeywordSearchFieldsEditorProps
) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);
  if (!analysisQuestions) {
    return null;
  }

  /**
   * Does a little cleanup of tags:
   * 1. remove whitespace before and after the tag
   * 2. no duplicates (needed in addition to `onlyUnique` option on
   *    `<TagsInput>`, because of whitespace changes)
   */
  function onKeywordsChange(newKeywords: string[]) {
    const cleanTags = Array.from(new Set(newKeywords.map((tag) => tag.trim())));

    props.onFieldsChange({
      ...props.fields,
      keywords: cleanTags,
    });
  }

  function onSourceChange(newSource: LanguageCode | null) {
    props.onFieldsChange({
      ...props.fields,
      source: newSource ? newSource : undefined,
    });
  }

  const inputHtmlId = 'keywordSearchFieldsEditor_TagsInput_Input';

  return (
    <section className={styles.root}>
      <section className={styles.left}>
        <label className={styles.sideLabel} htmlFor={inputHtmlId}>
          {t('Look for')}
        </label>

        {/*
          While doing https://github.com/kobotoolbox/kpi/issues/4594 ensure that
          a support article is written and a link updated here <3
        */}
        <a className={styles.helpLink} href={'#TODO'}>
          <Icon name={'information'} size='xs' />
          {t('help')}
        </a>

        <TagsInput
          value={props.fields.keywords || []}
          onChange={onKeywordsChange}
          inputProps={{
            id: inputHtmlId,
            placeholder: t('Type keywords'),
          }}
          onlyUnique
          addOnBlur
          addOnPaste
        />
      </section>

      <section className={styles.right}>
        <label className={styles.sideLabel}>
          {t('Search this transcript/translation:')}
        </label>

        <TransxSelector
          languageCodes={singleProcessingStore.getSources()}
          selectedLanguage={props.fields.source}
          onChange={onSourceChange}
          size='l'
          type='outline'
        />
      </section>
    </section>
  );
}
