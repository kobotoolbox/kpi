import React, {useMemo, useReducer} from 'react';
import bodyStyles from './processingBody.module.scss';
import AnalysisQuestionsList from './analysis/analysisQuestionsList.component';
import Button from 'js/components/common/button';
import {
  initialState,
  analysisQuestionsReducer,
} from './analysis/analysisQuestions.reducer';
import AnalysisQuestionsContext from './analysis/analysisQuestions.context';

export default function AnalysisTabContent() {
  const [state, dispatch] = useReducer(analysisQuestionsReducer, initialState);
  const contextValue = useMemo(() => {
    return {state, dispatch};
  }, [state, dispatch]);

  return (
    <div className={bodyStyles.root}>
      <AnalysisQuestionsContext.Provider value={contextValue}>
        <Button
          type='full'
          color='blue'
          size='m'
          startIcon='plus'
          label={t('Add question')}
          onClick={() =>
            dispatch({type: 'addQuestion', payload: {type: 'aq_text'}})
          }
        />

        <AnalysisQuestionsList />
      </AnalysisQuestionsContext.Provider>
    </div>
  );
}
