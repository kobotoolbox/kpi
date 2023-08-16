import React, {useContext} from 'react';
import AnalysisQuestionsContext from './analysisQuestions.context';
import AnalysisContentEmpty from './analysisContentEmpty.component';
import AnalysisQuestionsList from './list/analysisQuestionsList.component';
import styles from './analysisContent.module.scss';

/** Displays either a special message for no content, or the list of questions. */
export default function AnalysisContent() {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  if (!analysisQuestions) {
    return null;
  }

  return (
    <section className={styles.root}>
      {analysisQuestions.state.questions.length === 0 && (
        <AnalysisContentEmpty />
      )}

      {analysisQuestions.state.questions.length > 0 && (
        <AnalysisQuestionsList />
      )}
    </section>
  );
}
