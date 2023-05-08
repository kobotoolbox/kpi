import React, {useContext, useState} from 'react';
import TextBox from 'js/components/common/textBox';
import type {AvailableType} from 'js/components/common/textBox';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import {AUTO_SAVE_TYPING_DELAY} from 'js/components/processing/analysis/constants';
import {
  findQuestion,
  getQuestionTypeDefinition,
  quietlyUpdateResponse,
} from 'js/components/processing/analysis/utils';
import CommonHeader from './commonHeader.component';
import commonStyles from './common.module.scss';

interface DefaultResponseFormProps {
  uid: string;
}

/**
 * A component responsible for displaying an interactive form for user to
 * respond to given analysis question or to modify existing response.
 *
 * If user has sufficient permissions, it allows to toggle the question
 * definition editor.
 */
export default function DefaultResponseForm(props: DefaultResponseFormProps) {
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
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>();

  function saveResponse() {
    clearTimeout(typingTimer);

    quietlyUpdateResponse(
      analysisQuestions?.state,
      analysisQuestions?.dispatch,
      props.uid,
      response
    );
  }

  function saveResponseDelayedAndQuietly() {
    clearTimeout(typingTimer);
    // After 5 seconds we auto save
    setTypingTimer(setTimeout(saveResponse, AUTO_SAVE_TYPING_DELAY));
  }

  // This component is a general/default component for handling responses, and
  // we want it to present a text input. But since creating a separate component
  // for `qual_number` with a single line being different, we opt for this litte
  // check here.
  let textBoxType: AvailableType = 'text-multiline';
  if (qaDefinition.type === 'qual_number') {
    textBoxType = 'number';
  }

  return (
    <>
      <CommonHeader uid={props.uid} />

      <section className={commonStyles.fullWidthContent}>
        <TextBox
          type={textBoxType}
          value={response}
          onChange={(newResponse: string) => {
            setResponse(newResponse);
            saveResponseDelayedAndQuietly();
          }}
          placeholder={t('Start typing your answer')}
          onBlur={saveResponse}
          customModifiers='on-white'
        />
      </section>
    </>
  );
}
