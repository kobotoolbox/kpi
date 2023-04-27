import React, {useState, useContext} from 'react';
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import TextBox from 'js/components/common/textBox';
import styles from './analysisQuestionForm.module.scss';
import AnalysisQuestionsContext from './analysisQuestions.context';
import {AUTO_SAVE_TYPING_DELAY} from './constants';
import {findQuestion, getQuestionTypeDefinition} from './utils';
import KoboPrompt from 'js/components/modals/koboPrompt';

interface AnalysisQuestionFormProps {
  uid: string;
}

/**
 * A component responsible for displaying an interactive form for user to
 * respond to given analysis question or to modify existing response.
 *
 * If user has sufficient permissions, it allows to toggle the question
 * definition editor.
 */
export default function AnalysisQuestionForm(props: AnalysisQuestionFormProps) {
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
  const [isDeletePromptOpen, setIsDeletePromptOpen] = useState(false);
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

  /**
   * Means that user clicked "Edit" button and wants to start modyfing
   * the question definition.
   */
  function openQuestionInEditor() {
    analysisQuestions?.dispatch({
      type: 'startEditingQuestion',
      payload: {uid: props.uid},
    });
  }

  function deleteQuestion() {
    analysisQuestions?.dispatch({
      type: 'deleteQuestion',
      payload: {uid: props.uid},
    });

    setIsDeletePromptOpen(false);

    // TODO make actual API call here
    // For now we make a fake response
    console.log('QA fake API call: delete question');
    setTimeout(() => {
      console.log('QA fake API call: delete question DONE');
      analysisQuestions?.dispatch({
        type: 'deleteQuestionCompleted',
        payload: {
          questions: analysisQuestions?.state.questions.filter(
            (item) => item.uid !== props.uid
          ),
        },
      });
    }, 1000);
  }

  return (
    <div className={styles.root}>
      <KoboPrompt
        isOpen={isDeletePromptOpen}
        onRequestClose={() => setIsDeletePromptOpen(false)}
        title={t('Delete this question?')}
        buttons={[
          {
            type: 'frame',
            color: 'storm',
            label: t('Cancel'),
            onClick: () => setIsDeletePromptOpen(false),
          },
          {
            type: 'full',
            color: 'red',
            label: t('Delete'),
            onClick: deleteQuestion,
          },
        ]}
      >
        <p>
          {t(
            'Are you sure you want to delete this question? This action cannot be undone.'
          )}
        </p>
      </KoboPrompt>

      <header className={styles.header}>
        <div className={styles.icon}>
          <Icon name={qaDefinition.icon} size='xl' />
        </div>

        <label className={styles.label}>{question.label}</label>

        <Button
          type='bare'
          color='storm'
          size='s'
          startIcon='edit'
          onClick={openQuestionInEditor}
          // We only allow editing one question at a time, so adding new is not
          // possible until user stops editing
          isDisabled={analysisQuestions?.state.questionsBeingEdited.length !== 0 || analysisQuestions?.state.isPending}
        />

        <Button
          type='bare'
          color='storm'
          size='s'
          startIcon='trash'
          onClick={() => setIsDeletePromptOpen(true)}
          isDisabled={analysisQuestions?.state.isPending}
        />
      </header>

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
    </div>
  );
}
