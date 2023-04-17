import React, {useContext} from 'react';
import AnalysisQuestionEditor from './analysisQuestionEditor.component';
import AnalysisQuestionForm from './analysisQuestionForm.component';
import AnalysisQuestionsContext from './analysisQuestions.context';
import styles from './analysisQuestionsList.module.scss';

export default function AnalysisQuestionsList() {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  return (
    <ul className={styles.root}>
      {analysisQuestions?.state.questions.map((question) => (
        <li className={styles.row} key={question.uid}>
          {analysisQuestions.state.questionsBeingEdited.includes(
            question.uid
          ) && <AnalysisQuestionEditor uid={question.uid} />}
          {!analysisQuestions.state.questionsBeingEdited.includes(
            question.uid
          ) && <AnalysisQuestionForm uid={question.uid} />}
        </li>
      ))}
    </ul>
  );
}
