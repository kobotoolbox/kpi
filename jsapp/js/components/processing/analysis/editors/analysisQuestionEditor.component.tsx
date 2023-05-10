import React, {useState, useContext} from 'react';
import Icon from 'js/components/common/icon';
import styles from './analysisQuestionEditor.module.scss';
import commonStyles from 'js/components/processing/analysis/responseForms/common.module.scss';
import TextBox from 'js/components/common/textBox';
import Button from 'js/components/common/button';
import {
  findQuestion,
  getQuestionTypeDefinition,
} from 'js/components/processing/analysis/utils';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import KeywordSearchFieldsEditor from './keywordSearchFieldsEditor.component';
import type {AdditionalFields} from 'js/components/processing/analysis/constants';
import SelectXFieldsEditor from './selectXFieldsEditor.component';

interface DefaultEditorProps {
  uid: string;
}

export default function DefaultEditor(props: DefaultEditorProps) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  // Get the question data from state (with safety check)
  const question = findQuestion(props.uid, analysisQuestions?.state);
  if (!question) {
    return null;
  }

  // Get the question definition (with safety check)
  const qaDefinition = getQuestionTypeDefinition(question.type);
  if (!qaDefinition) {
    return null;
  }

  const [label, setLabel] = useState<string>(question.label);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [additionalFieldsErrorMessage, setAdditionalFieldsErrorMessage] =
    useState<string | undefined>();
  const [additionalFields, setAdditionalFields] = useState<
    AdditionalFields | undefined
  >(question.additionalFields ? question.additionalFields : undefined);

  function onTextBoxChange(newLabel: string) {
    setLabel(newLabel);
    if (newLabel !== '' && errorMessage !== undefined) {
      setErrorMessage(undefined);
    }
  }

  function onAdditionalFieldsChange(newFields: AdditionalFields) {
    setAdditionalFields(newFields);
    if (additionalFieldsErrorMessage) {
      setAdditionalFieldsErrorMessage(undefined);
    }
  }

  function saveQuestion() {
    let hasErrors = false;

    // Check missing label
    if (label === '') {
      setErrorMessage(t('Question label cannot be empty'));
      hasErrors = true;
    }

    // Check missing additional fields
    if (
      // Apply only to questions that has additional fields
      (qaDefinition?.additionalFieldNames &&
        // 1. Check if there are no additional fields
        additionalFields === undefined) ||
      // 2. Check if the amount of provided additional fields is the same as the
      // required amount
      (additionalFields !== undefined &&
        qaDefinition?.additionalFieldNames?.length !==
          Object.keys(additionalFields).length) ||
      // 3. Check if some of the provided fields are empty
      (additionalFields !== undefined &&
        qaDefinition?.additionalFieldNames?.some(
          (fieldName) => additionalFields[fieldName]?.length === 0
        ))
    ) {
      setAdditionalFieldsErrorMessage(t('Some required fields are missing'));
      hasErrors = true;
    }

    // Save only if there are no errors
    if (!hasErrors) {
      analysisQuestions?.dispatch({
        type: 'updateQuestion',
        payload: {
          uid: props.uid,
          label: label,
          additionalFields: additionalFields,
        },
      });

      // TODO make actual API call here
      // For now we make a fake response
      console.log('QA fake API call: update question');
      setTimeout(() => {
        console.log('QA fake API call: update question DONE');
        analysisQuestions?.dispatch({
          type: 'updateQuestionCompleted',
          payload: {
            // We return the same questions array, just replacing one item (it's
            // the updated question).
            questions: analysisQuestions?.state.questions.map((aq) => {
              if (aq.uid === props.uid) {
                // Successfully updating/saving question makes it not a draft
                delete aq.isDraft;
                return {
                  ...aq,
                  label,
                  additionalFields,
                };
              } else {
                return aq;
              }
            }),
          },
        });
      }, 2000);
    }
  }

  function cancelEditing() {
    analysisQuestions?.dispatch({
      type: 'stopEditingQuestion',
      payload: {uid: props.uid},
    });
  }

  return (
    <>
      <header className={styles.header}>
        <div className={commonStyles.headerIcon}>
          <Icon name={qaDefinition.icon} size='xl' />
        </div>

        <TextBox
          value={label}
          onChange={onTextBoxChange}
          errors={errorMessage}
          placeholder={t('Type question')}
          customModifiers='on-white'
          renderFocused
          disabled={analysisQuestions?.state.isPending}
        />

        <Button
          type='frame'
          color='storm'
          size='m'
          label={t('Save')}
          onClick={saveQuestion}
          isPending={analysisQuestions?.state.isPending}
        />

        <Button
          type='bare'
          color='storm'
          size='m'
          startIcon='close'
          onClick={cancelEditing}
          isDisabled={analysisQuestions?.state.isPending}
        />
      </header>

      {qaDefinition.additionalFieldNames && (
        <section className={commonStyles.alignedContent}>
          {question.type === 'qual_auto_keyword_count' && (
            <KeywordSearchFieldsEditor
              uid={question.uid}
              fields={additionalFields || {source: '', keywords: []}}
              onFieldsChange={onAdditionalFieldsChange}
            />
          )}

          {(question.type === 'qual_select_one' ||
            question.type === 'qual_select_multiple') && (
            <SelectXFieldsEditor
              uid={question.uid}
              fields={additionalFields || {choices: []}}
              onFieldsChange={onAdditionalFieldsChange}
            />
          )}

          {additionalFieldsErrorMessage && (
            <p>{additionalFieldsErrorMessage}</p>
          )}
        </section>
      )}
    </>
  );
}
