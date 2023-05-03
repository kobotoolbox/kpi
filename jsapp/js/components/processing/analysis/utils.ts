import type {AnalysisQuestionsState} from './analysisQuestions.reducer';
import type {AnalysisQuestionType} from './constants';
import {ANALYSIS_QUESTION_DEFINITIONS} from './constants';

/** Finds given question in state */
export function findQuestion(
  uid: string,
  state: AnalysisQuestionsState | undefined
) {
  return state?.questions.find((question) => question.uid === uid);
}

export function getQuestionTypeDefinition(type: AnalysisQuestionType) {
  return ANALYSIS_QUESTION_DEFINITIONS.find((definition) => definition.type === type);
}
