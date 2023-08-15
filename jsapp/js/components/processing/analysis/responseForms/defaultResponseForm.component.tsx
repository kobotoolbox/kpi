import React, {useContext, useState} from 'react';
import TextBox from 'js/components/common/textBox';
import type {AvailableType} from 'js/components/common/textBox';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import {AUTO_SAVE_TYPING_DELAY} from 'js/components/processing/analysis/constants';
import {
  findQuestion,
  getQuestionTypeDefinition,
  updateResponse,
} from 'js/components/processing/analysis/utils';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import CommonHeader from './commonHeader.component';
import commonStyles from './common.module.scss';

interface DefaultResponseFormProps {
  uuid: string;
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
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>();

  async function saveResponse() {
    clearTimeout(typingTimer);

    if (!question || !singleProcessingStore.currentQuestionQpath) {
      // TODO handle this (unlikely) error somehow
      return;
    }

    // Step 1: Let the reducer know what we're about to do
    analysisQuestions?.dispatch({type: 'updateResponse'});

    // Step 2: Store the response using the `advanced_submission_post` API
    try {
      const result = await updateResponse(
        singleProcessingStore.currentAssetUid,
        singleProcessingStore.currentSubmissionEditId,
        singleProcessingStore.currentQuestionQpath,
        question.uuid,
        question.type,
        response
      );
      analysisQuestions?.dispatch({
        type: 'updateResponseCompleted',
        payload: result,
      });
    } catch (err) {
      // TODO should this be handled in some different way?
      console.log('catch err', err);
      analysisQuestions?.dispatch({type: 'updateResponseFailed'});
    }
  }

  function saveResponseDelayedAndQuietly() {
    clearTimeout(typingTimer);
    // After 5 seconds we auto save
    setTypingTimer(setTimeout(saveResponse, AUTO_SAVE_TYPING_DELAY));
  }

  // This component is a general/default component for handling responses, and
  // we want it to present a text input. But since creating a separate component
  // for `qual_integer` with a single line being different, we opt for this litte
  // check here.
  let textBoxType: AvailableType = 'text-multiline';
  if (qaDefinition.type === 'qual_integer') {
    textBoxType = 'number';
  }

  return (
    <>
      <CommonHeader uuid={props.uuid} />

      <section className={commonStyles.content}>
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
          disabled={analysisQuestions?.state.isPending}
        />
      </section>
    </>
  );
}
