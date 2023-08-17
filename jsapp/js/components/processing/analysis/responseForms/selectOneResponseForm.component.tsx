import React, {useContext, useState} from 'react';
import CommonHeader from './commonHeader.component';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import {
  findQuestion,
  getQuestionTypeDefinition,
  updateResponseAndReducer,
} from 'js/components/processing/analysis/utils';
import Radio from 'js/components/common/radio';
import type {RadioOption} from 'js/components/common/radio';
import commonStyles from './common.module.scss';
import classNames from 'classnames';
import styles from './selectOneResponseForm.module.scss';

interface SelectOneResponseFormProps {
  uuid: string;
}

/**
 * Displays a common header and radio input with all available choices.
 */
export default function SelectOneResponseForm(
  props: SelectOneResponseFormProps
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

  // This will either be an existing response or an empty string
  const initialResponse =
    typeof question.response === 'string' ? question.response : '';

  const [response, setResponse] = useState<string>(initialResponse);

  function onRadioChange(newResponse: string) {
    if (!analysisQuestions) {
      return;
    }

    // Update local state
    setResponse(newResponse);

    // Update endpoint and reducer
    updateResponseAndReducer(
      analysisQuestions.dispatch,
      props.uuid,
      question?.type,
      newResponse
    );
  }

  function getOptions(): RadioOption[] {
    if (question?.additionalFields?.choices) {
      return question?.additionalFields?.choices.map((choice) => {
        return {
          value: choice.uuid,
          label: choice.labels._default,
        };
      });
    }
    return [];
  }

  return (
    <>
      <CommonHeader uuid={props.uuid} />

      <section
        className={classNames([commonStyles.content, styles.radioWrapper])}
      >
        <Radio
          options={getOptions()}
          name={question.labels._default}
          onChange={onRadioChange}
          selected={response}
          isClearable
          isDisabled={analysisQuestions.state.isPending}
        />
      </section>
    </>
  );
}
