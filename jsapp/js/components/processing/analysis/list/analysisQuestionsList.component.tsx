import React, {useCallback, useContext} from 'react';
import AnalysisQuestionsContext from '../analysisQuestions.context';
import styles from './analysisQuestionsList.module.scss';
import AnalysisQuestionRow from './analysisQuestionRow.component';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';
import { _getActiveAssetAdvancedFeatures } from 'jsapp/js/stores/AssetAdvancedFeaturesStore';

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

  const urlHashParts = [...window.location.hash.split('/')].reverse();
  const analysisQuestionsStore = _getActiveAssetAdvancedFeatures();
  const [ submissionUuid, qpath ] = urlHashParts;
  const questions = analysisQuestionsStore.qualQuestions.qualSurveyForQpath(qpath);
  console.log('questions: ', questions);
  return (
    <DndProvider backend={HTML5Backend}>
      <ul className={styles.root}>
        {questions.map((question:any, index: number) => (
          <AnalysisQuestionRow
            questiondata={question}
            uid={question.uuid}
            index={index}
            key={question.uuid}
            moveRow={moveRow}
          />
        ))}
      </ul>
    </DndProvider>
  );
}
