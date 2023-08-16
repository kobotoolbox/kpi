import React, {useCallback, useContext} from 'react';
import AnalysisQuestionsContext from '../analysisQuestions.context';
import styles from './analysisQuestionsList.module.scss';
import AnalysisQuestionRow from './analysisQuestionRow.component';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';

// TODO add description comment
export default function AnalysisQuestionsList() {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  if (!analysisQuestions) {
    return null;
  }

  const moveRow = useCallback(
    (uuid: string, oldIndex: number, newIndex: number) => {
      analysisQuestions.dispatch({
        type: 'reorderQuestion',
        payload: {uuid: uuid, oldIndex, newIndex},
      });
    },
    []
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <ul className={styles.root}>
        {analysisQuestions.state.questions.map((question, index: number) => (
          <AnalysisQuestionRow
            uuid={question.uuid}
            index={index}
            key={question.uuid}
            moveRow={moveRow}
          />
        ))}
      </ul>
    </DndProvider>
  );
}
