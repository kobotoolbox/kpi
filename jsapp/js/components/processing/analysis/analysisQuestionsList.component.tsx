import React, {useContext} from 'react';
import AnalysisQuestionEditor from './editors/analysisQuestionEditor.component';
import KeywordSearchEditor from './editors/keywordSearchEditor';
import AnalysisQuestionForm from './analysisQuestionForm.component';
import AnalysisQuestionsContext from './analysisQuestions.context';
import styles from './analysisQuestionsList.module.scss';
import type {AnalysisQuestion} from './constants';

export default function AnalysisQuestionsList() {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  function renderItem(question: AnalysisQuestion) {
    if (analysisQuestions?.state.questionsBeingEdited.includes(question.uid)) {
      return (<AnalysisQuestionEditor uid={question.uid} />);
    } else {
      return (<AnalysisQuestionForm uid={question.uid} />);
    }
  }

  return (
    <ul className={styles.root}>
      {analysisQuestions?.state.questions.map((question) => (
        <li className={styles.row} key={question.uid}>
          {renderItem(question)}
        </li>
      ))}
    </ul>
  );
}
