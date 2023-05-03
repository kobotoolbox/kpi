import React, {useContext, useState} from 'react';
import TextBox from 'js/components/common/textBox';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import {AUTO_SAVE_TYPING_DELAY} from 'js/components/processing/analysis/constants';
import {findQuestion, getQuestionTypeDefinition} from 'js/components/processing/analysis/utils';
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

    analysisQuestions?.dispatch({
      type: 'updateResponse',
      payload: {uid: props.uid, response: response},
    });

    // TODO make actual API call here
    // For now we make a fake response
    console.log('QA fake API call: update response');
    setTimeout(() => {
      console.log('QA fake API call: update response DONE');
      analysisQuestions?.dispatch({
        type: 'updateResponseCompleted',
        payload: {
          questions: analysisQuestions?.state.questions.map(
            (item) => {
              if (item.uid === props.uid) {
                return {
                  ...item,
                  response: response,
                };
              } else {
                return item;
              }
            }
          ),
        },
      });
    }, 1000);
  }

  function saveResponseDelayedAndQuietly() {
    clearTimeout(typingTimer);
    // After 5 seconds we auto save
    setTypingTimer(setTimeout(saveResponse, AUTO_SAVE_TYPING_DELAY));
  }

  return (
    <>
      <CommonHeader uid={props.uid}/>

      <section className={commonStyles.fullWidthContent}>
        <TextBox
          type='text-multiline'
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
