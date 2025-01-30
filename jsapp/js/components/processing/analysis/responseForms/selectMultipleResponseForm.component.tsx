import React, {useContext, useState} from 'react';
import CommonHeader from './commonHeader.component';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import {
  findQuestion,
  getQuestionTypeDefinition,
  updateResponseAndReducer,
} from 'js/components/processing/analysis/utils';
import type {MultiCheckboxItem} from 'js/components/common/multiCheckbox';
import MultiCheckbox from 'js/components/common/multiCheckbox';
import commonStyles from './common.module.scss';

interface SelectMultipleResponseFormProps {
  uuid: string;
  canEdit: boolean;
}

/**
 * Displays a common header and a list of checkboxes - each one for the choice
 * available.
 */
export default function SelectMultipleResponseForm(
  props: SelectMultipleResponseFormProps
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

  // This will either be an existing list of selected choices, or an empty list.
  const initialResponse = Array.isArray(question.response)
    ? question.response
    : [];

  const [response, setResponse] = useState<string[]>(initialResponse);

  function onCheckboxesChange(items: MultiCheckboxItem[]) {
    if (!analysisQuestions || !question) {
      return;
    }

    const newResponse = items
      .filter((item) => item.checked)
      .map((item) => item.name);

    analysisQuestions?.dispatch({type: 'hasUnsavedWork'});

    // Update local state
    setResponse(newResponse);

    // Update endpoint and reducer
    updateResponseAndReducer(
      analysisQuestions.dispatch,
      question.xpath,
      props.uuid,
      question.type,
      newResponse
    );
  }

  function getCheckboxes(): MultiCheckboxItem[] {
    if (question?.additionalFields?.choices) {
      return (
        question?.additionalFields?.choices
          // We hide all choices flagged as deleted…
          .filter((item) => !item.options?.deleted)
          // …and then we produce checkbox object of each choice left
          .map((choice) => {
            return {
              name: choice.uuid,
              label: choice.labels._default,
              checked: response.includes(choice.uuid),
            };
          })
      );
    }
    return [];
  }

  return (
    <>
      <CommonHeader uuid={props.uuid} />

      <section className={commonStyles.content}>
        <MultiCheckbox
          type='bare'
          items={getCheckboxes()}
          onChange={onCheckboxesChange}
          disabled={!props.canEdit}
        />
      </section>
    </>
  );
}
