import React, {useContext} from 'react';
import AnalysisQuestionsContext from './analysisQuestions.context';
import styles from './analysisHeader.module.scss';
import Button from 'js/components/common/button';

export default function AnalysisHeader() {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  return (
    <header className={styles.root}>
      <Button
        type='full'
        color='blue'
        size='m'
        startIcon='plus'
        label={t('Add question')}
        onClick={() =>
          analysisQuestions?.dispatch({
            type: 'addQuestion',
            payload: {type: 'aq_text'},
          })
        }
        // We only allow editing one question at a time, so adding new is not
        // possible until user stops editing
        isDisabled={analysisQuestions?.state.questionsBeingEdited.length !== 0 || analysisQuestions?.state.isPending}
      />

      <span>
        {analysisQuestions?.state.isPending && t('Saving…')}
        {!analysisQuestions?.state.isPending && t('Saved')}
      </span>
    </header>
  );
}
