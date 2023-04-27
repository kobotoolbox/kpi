import React, {useContext, useState} from 'react';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import styles from './keywordSearchFieldsEditor.module.scss';
import AnalysisQuestionsContext from '../analysisQuestions.context';
import {findQuestion} from 'js/components/processing/analysis/utils';
import TagsInput from 'react-tagsinput';
import Icon from 'jsapp/js/components/common/icon';

interface KeywordSearchFieldsEditorProps {
  uid: string;
}

interface KeywordSearchFields {
  /** A list of keywords to search for. */
  keywords: string[];
  /** The transcript or translation source for the search. */
  source?: LanguageCode;
  hasErrors: boolean;
}

export default function KeywordSearchFieldsEditor(
  props: KeywordSearchFieldsEditorProps
) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  // Get the question data from state (with safety check)
  const question = findQuestion(props.uid, analysisQuestions?.state);
  if (!question) {
    return null;
  }

  const [fields, setFields] = useState<KeywordSearchFields>({
    keywords: [],
    hasErrors: true,
  });

  function onKeywordsChange(newKeywords: string[]) {
    // Does a little cleanup of tags:
    // 1. remove whitespace before and after the tag
    // 2. no duplicates (needed in addition to `onlyUnique` option on
    //    `<TagsInput>`, because of whitespace changes)
    const cleanTags = Array.from(new Set(newKeywords.map((tag) => tag.trim())));

    setFields({
      ...fields,
      keywords: cleanTags,
    });
  }

  const inputHtmlId = 'keywordSearchFieldsEditor_TagsInput_Input';

  return (
    <div className={styles.root}>
      <section className={styles.left}>
        <label htmlFor={inputHtmlId}>{t('Look for')}</label>

        <a className={styles.helpLink} href={'#TODO'}>
          <Icon name={'information'} size='xs'/>
          {t('help')}
        </a>

        <TagsInput
          value={fields.keywords}
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
        From file
      </section>
    </div>
  );
}
