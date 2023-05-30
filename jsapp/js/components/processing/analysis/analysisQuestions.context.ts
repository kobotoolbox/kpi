import React from 'react';
import type {
  AnalysisQuestionsState,
  AnalysisQuestionsAction,
} from './analysisQuestions.reducer';

interface AnalysisQuestionsContextType {
  state: AnalysisQuestionsState;
  dispatch: React.Dispatch<AnalysisQuestionsAction>;
}

const AnalysisQuestionsContext =
  React.createContext<AnalysisQuestionsContextType | null>(null);
export default AnalysisQuestionsContext;
