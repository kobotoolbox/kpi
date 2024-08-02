import React, {useState, useContext} from 'react';
import Icon from 'js/components/common/icon';
import styles from './analysisQuestionEditor.module.scss';
import commonStyles from '../responseForms/common.module.scss';
import TextBox from 'js/components/common/textBox';
import Button from 'js/components/common/button';
import {
  findQuestion,
  getQuestionTypeDefinition,
  getQuestionsFromSchema,
  updateSurveyQuestions,
} from 'js/components/processing/analysis/utils';
import AnalysisQuestionsContext from '../analysisQuestions.context';
import KeywordSearchFieldsEditor from './keywordSearchFieldsEditor.component';
import type {AdditionalFields, AnalysisQuestionInternal} from '../constants';
import SelectXFieldsEditor from './selectXFieldsEditor.component';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import clonedeep from 'lodash.clonedeep';
import {handleApiFail} from 'js/api';
import type {FailResponse} from 'js/dataInterface';

interface AnalysisQuestionEditorProps {
  uuid: string;
}

/**
 * Displays a form for editing question definition. All the question types share
 * the code for updating the question label. Some question types also can define
 * custom additional fields. For these we load additional forms.
 */
export default function AnalysisQuestionEditor(
  props: AnalysisQuestionEditorProps
) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);
  if (!analysisQuestions) {
    return null;
  }

  // Get the question data from state (with safety check)
  const question = findQuestion(props.uuid, analysisQuestions.state);
  if (!question) {
    return null;
  }

  // Get the question definition (with safety check)
  const qaDefinition = getQuestionTypeDefinition(question.type);
  if (!qaDefinition) {
    return null;
  }

  const [label, setLabel] = useState<string>(question.labels._default);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [additionalFieldsErrorMessage, setAdditionalFieldsErrorMessage] =
    useState<string | undefined>();
  // We need to clone `additionalFields` here to avoid mutating it
  const [additionalFields, setAdditionalFields] = useState<
    AdditionalFields | undefined
  >(
    question.additionalFields ? clonedeep(question.additionalFields) : undefined
  );

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

  async function saveQuestion() {
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
      // Step 1: Let the reducer know what we're about to do
      analysisQuestions?.dispatch({type: 'updateQuestion'});

      // Step 2: get current questions list, and update current question definition in it
      const updatedQuestions: AnalysisQuestionInternal[] =
        analysisQuestions?.state.questions.map((aq) => {
          const output = clonedeep(aq);
          // If this is the question we're currently editing, let's update what
          // we have in store.
          if (aq.uuid === props.uuid) {
            output.labels = {_default: label};

            // Set additional fields if any, or delete if it was removed
            if (additionalFields) {
              output.additionalFields = additionalFields;
            } else if (!additionalFields && aq.additionalFields) {
              delete output.additionalFields;
            }
          }
          return output;
        }) || [];

      // Step 3: update asset endpoint with new questions
      try {
        const response = await updateSurveyQuestions(
          singleProcessingStore.currentAssetUid,
          updatedQuestions
        );

        // We get all questions in the response, but we only need the one we've
        // just updated
        const newQuestions = getQuestionsFromSchema(response?.advanced_features);
        const currentNewQuestion = newQuestions.find((item) => item.uuid === props.uuid);

        if (currentNewQuestion) {
          // Step 4: update reducer's state with new list after the call finishes
          analysisQuestions?.dispatch({
            type: 'updateQuestionCompleted',
            payload: {question: currentNewQuestion},
          });
        } else {
          // This should never happen :) I.e. the list of questions from
          // `response` will include the question, it's just the `.find`
          // that has a possibility to return `undefined` :shrug:
          throw new Error('Question not found in the list of questions');
        }
      } catch (err) {
        handleApiFail(err as FailResponse);
        analysisQuestions?.dispatch({type: 'udpateQuestionFailed'});
      }
    }
  }

  function cancelEditing() {
    analysisQuestions?.dispatch({
      type: 'stopEditingQuestion',
      payload: {uuid: props.uuid},
    });
  }

  function onSubmit(evt: React.FormEvent<HTMLFormElement>) {
    evt.preventDefault();
  }

  return (
    <>
      <header className={styles.header}>
        <form className={styles.headerForm} onSubmit={onSubmit}>
          <div className={commonStyles.headerIcon}>
            <Icon name={qaDefinition.icon} size='xl' />
          </div>

          <TextBox
            value={label}
            onChange={onTextBoxChange}
            errors={errorMessage}
            placeholder={t('Type question')}
            className={styles.labelInput}
            renderFocused
            size='m'
          />

          <Button
            type='primary'
            size='m'
            label={t('Save')}
            onClick={saveQuestion}
            isPending={analysisQuestions.state.isPending}
            isSubmit
          />

          <Button
            type='secondary'
            size='m'
            label={t('Cancel')}
            onClick={cancelEditing}
            isDisabled={analysisQuestions.state.isPending}
          />
        </form>
      </header>

      {qaDefinition.additionalFieldNames && (
        <section className={commonStyles.content}>
          {question.type === 'qual_auto_keyword_count' && (
            <KeywordSearchFieldsEditor
              questionUuid={question.uuid}
              fields={additionalFields || {source: '', keywords: []}}
              onFieldsChange={onAdditionalFieldsChange}
            />
          )}

          {(question.type === 'qual_select_one' ||
            question.type === 'qual_select_multiple') && (
            <SelectXFieldsEditor
              questionUuid={question.uuid}
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
