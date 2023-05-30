import React, {useContext} from 'react';
import AnalysisQuestionsContext from '../analysisQuestions.context';
import styles from './analysisQuestionsList.module.scss';
import Row from './analysisQuestionRow.component';

export default function AnalysisQuestionsList() {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  if (!analysisQuestions) {
    return null;
  }

  return (
    <ul className={styles.root}>
      {analysisQuestions.state.questions.map((question) => (
        <Row question={question} key={question.uid} />
      ))}
    </ul>
  );
}
