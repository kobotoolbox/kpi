import type {AnalysisQuestionsState} from './analysisQuestions.reducer';

/** Finds given question in state */
export function findQuestion(
  uid: string,
  state: AnalysisQuestionsState | undefined
) {
  return state?.questions.find((question) => question.uid === uid);
}
