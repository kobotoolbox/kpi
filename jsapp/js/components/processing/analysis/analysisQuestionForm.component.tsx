import React, {useState, useContext} from 'react';
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import TextBox from 'js/components/common/textBox';
import styles from './analysisQuestionForm.module.scss';
import AnalysisQuestionsContext from './analysisQuestions.context';
import {ANALYSIS_QUESTION_DEFINITIONS} from './constants';
import {findQuestion} from './analysisQuestions.utils';
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

  const question = findQuestion(props.uid, analysisQuestions?.state);

  if (!question) {
    return null;
  }

  const [response, setResponse] = useState<string>(question.response);
  const [isDeletePromptOpen, setIsDeletePromptOpen] = useState(false);

  const qaDefinition = ANALYSIS_QUESTION_DEFINITIONS[question.type];

  function onTextboxBlur() {
    analysisQuestions?.dispatch({
      type: 'updateQuestionResponse',
      payload: {uid: props.uid, response: response},
    });
  }

  /**
   * Means that user clicked "Edit" button and wants to start modyfing
   * the question definition.
   */
  function onOpenEdit() {
    analysisQuestions?.dispatch({
      type: 'startEditingQuestionDefinition',
      payload: {uid: props.uid},
    });
  }

  function onConfirmDelete() {
    analysisQuestions?.dispatch({
      type: 'deleteQuestion',
      payload: {uid: props.uid},
    });
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
            onClick: onConfirmDelete,
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
          onClick={onOpenEdit}
        />

        <Button
          type='bare'
          color='storm'
          size='s'
          startIcon='trash'
          onClick={() => setIsDeletePromptOpen(true)}
        />
      </header>

      <TextBox
        type='text-multiline'
        value={response}
        onChange={setResponse}
        placeholder={t('Start typing your answer')}
        onBlur={onTextboxBlur}
        customModifiers='on-white'
      />
    </div>
  );
}
