import React from 'react';
import type {AnalysisQuestionsState} from './analysisQuestions.reducer';
import type {AnalysisQuestionsAction} from './analysisQuestions.actions';

interface AnalysisQuestionsContextType {
  state: AnalysisQuestionsState;
  dispatch: React.Dispatch<AnalysisQuestionsAction>;
}

const AnalysisQuestionsContext =
  React.createContext<AnalysisQuestionsContextType | null>(null);
export default AnalysisQuestionsContext;
