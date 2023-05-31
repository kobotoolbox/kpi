import type {
  AnalysisQuestionsAction,
  AnalysisQuestionsState,
} from './analysisQuestions.reducer';
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
  return ANALYSIS_QUESTION_DEFINITIONS.find(
    (definition) => definition.type === type
  );
}

export function quietlyUpdateResponse(
  state: AnalysisQuestionsState | undefined,
  dispatch: React.Dispatch<AnalysisQuestionsAction> | undefined,
  questionUid: string,
  response: string
) {
  if (!state || !dispatch) {
    return;
  }

  dispatch({type: 'updateResponse'});

  // TODO make actual API call here
  // For now we make a fake response
  console.log('QA fake API call: update response', questionUid, response);
  setTimeout(() => {
    console.log('QA fake API call: update response DONE');
    dispatch({
      type: 'updateResponseCompleted',
      payload: {
        questions: state.questions.map((item) => {
          if (item.uid === questionUid) {
            return {
              ...item,
              response: response,
            };
          } else {
            return item;
          }
        }),
      },
    });
  }, 1000);
}
