import React, {useContext, useState} from 'react';
import CommonHeader from './commonHeader.component';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import {
  findQuestion,
  getQuestionTypeDefinition,
  quietlyUpdateResponse,
} from 'js/components/processing/analysis/utils';
import Radio from 'js/components/common/radio';
import type {RadioOption} from 'js/components/common/radio';
import Button from 'jsapp/js/components/common/button';
import commonStyles from './common.module.scss';
import classNames from 'classnames';
import styles from './selectOneResponseForm.module.scss';

interface SelectOneResponseFormProps {
  uid: string;
}

export default function SelectOneResponseForm(
  props: SelectOneResponseFormProps
) {
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

  const [response, setResponse] = useState<string>(question.response);

  function onRadioChange(newResponse: string) {
    setResponse(newResponse);

    quietlyUpdateResponse(
      analysisQuestions?.state,
      analysisQuestions?.dispatch,
      props.uid,
      response
    );
  }

  function getOptions(): RadioOption[] {
    if (question?.additionalFields?.choices) {
      return question?.additionalFields?.choices.map((choice) => {
        return {
          value: choice.uid,
          label: choice.label,
        };
      });
    }
    return [];
  }

  function clear() {
    setResponse('');
  }

  return (
    <>
      <CommonHeader uid={props.uid} />

      <section className={classNames([commonStyles.content, styles.radioWrapper])}>
        <Radio
          options={getOptions()}
          name={question.label}
          onChange={onRadioChange}
          selected={response}
        />

        <Button
          type='bare'
          color='storm'
          size='s'
          onClick={clear}
          label={t('Clear')}
        />
      </section>
    </>
  );
}
