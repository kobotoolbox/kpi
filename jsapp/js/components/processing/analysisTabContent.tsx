import React, {useMemo, useReducer} from 'react';
import bodyStyles from './processingBody.module.scss';
import AnalysisQuestionsList from './analysis/analysisQuestionsList.component';
import {
  initialState,
  analysisQuestionsReducer,
} from './analysis/analysisQuestions.reducer';
import AnalysisQuestionsContext from './analysis/analysisQuestions.context';
import AnalysisHeader from './analysis/analysisHeader';

export default function AnalysisTabContent() {
  const [state, dispatch] = useReducer(analysisQuestionsReducer, initialState);
  const contextValue = useMemo(() => {
    return {state, dispatch};
  }, [state, dispatch]);

  return (
    <div className={bodyStyles.root}>
      <AnalysisQuestionsContext.Provider value={contextValue}>
        <AnalysisHeader />

        <AnalysisQuestionsList />
      </AnalysisQuestionsContext.Provider>
    </div>
  );
}
