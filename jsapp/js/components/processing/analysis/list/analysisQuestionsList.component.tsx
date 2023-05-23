import React, {useCallback, useContext} from 'react';
import AnalysisQuestionsContext from '../analysisQuestions.context';
import styles from './analysisQuestionsList.module.scss';
import AnalysisQuestionRow from './analysisQuestionRow.component';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';

export default function AnalysisQuestionsList() {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  if (!analysisQuestions) {
    return null;
  }

  const moveRow = useCallback(
    (uid: string, oldIndex: number, newIndex: number) => {
      analysisQuestions.dispatch({
        type: 'reorderQuestion',
        payload: {uid, oldIndex, newIndex},
      });
    },
    []
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <ul className={styles.root}>
        {analysisQuestions.state.questions.map((question, index: number) => (
          <AnalysisQuestionRow
            uid={question.uid}
            index={index}
            key={question.uid}
            moveRow={moveRow}
          />
        ))}
      </ul>
    </DndProvider>
  );
}
