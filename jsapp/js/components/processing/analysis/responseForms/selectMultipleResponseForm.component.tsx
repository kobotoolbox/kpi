import React, {useContext, useState} from 'react';
import CommonHeader from './commonHeader.component';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import {
  findQuestion,
  getQuestionTypeDefinition,
  quietlyUpdateResponse,
} from 'js/components/processing/analysis/utils';
import type {MultiCheckboxItem} from 'js/components/common/multiCheckbox';
import MultiCheckbox from 'js/components/common/multiCheckbox';
import commonStyles from './common.module.scss';

interface SelectMultipleResponseFormProps {
  uuid: string;
}

export default function SelectMultipleResponseForm(
  props: SelectMultipleResponseFormProps
) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  // Get the question data from state (with safety check)
  const question = findQuestion(props.uuid, analysisQuestions?.state);
  if (!question) {
    return null;
  }

  // Get the question definition (with safety check)
  const qaDefinition = getQuestionTypeDefinition(question.type);
  if (!qaDefinition) {
    return null;
  }

  const [response, setResponse] = useState<string>(question.response);

  function onCheckboxesChange(items: MultiCheckboxItem[]) {
    const newFields = items
      .filter((item) => item.checked)
      .map((item) => item.name);
    const newResponse = newFields.join(',');

    setResponse(newResponse);

    quietlyUpdateResponse(
      analysisQuestions?.state,
      analysisQuestions?.dispatch,
      props.uuid,
      newResponse
    );
  }

  function getCheckboxes(): MultiCheckboxItem[] {
    if (question?.additionalFields?.choices) {
      return question?.additionalFields?.choices.map((choice) => {
        return {
          name: choice.uuid,
          label: choice.label,
          checked: response.split(',').includes(choice.uuid),
        };
      });
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
        />
      </section>
    </>
  );
}
