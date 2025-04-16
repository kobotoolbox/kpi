import React from 'react'

import type { AnalysisQuestionsAction } from './analysisQuestions.actions'
import type { AnalysisQuestionsState } from './analysisQuestions.reducer'

interface AnalysisQuestionsContextType {
  state: AnalysisQuestionsState
  dispatch: React.Dispatch<AnalysisQuestionsAction>
}

const AnalysisQuestionsContext = React.createContext<AnalysisQuestionsContextType | null>(null)
export default AnalysisQuestionsContext
