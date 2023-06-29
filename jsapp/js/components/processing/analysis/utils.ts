import type {AnalysisQuestionsState} from './analysisQuestions.reducer';
import type {AnalysisQuestionsAction} from './analysisQuestions.actions';
import type {AnalysisQuestionType} from './constants';
import {ANALYSIS_QUESTION_TYPES} from './constants';

/** Finds given question in state */
export function findQuestion(
  uuid: string,
  state: AnalysisQuestionsState | undefined
) {
  return state?.questions.find((question) => question.uuid === uuid);
}

export function getQuestionTypeDefinition(type: AnalysisQuestionType) {
  return ANALYSIS_QUESTION_TYPES.find(
    (definition) => definition.type === type
  );
}

export function quietlyUpdateResponse(
  state: AnalysisQuestionsState | undefined,
  dispatch: React.Dispatch<AnalysisQuestionsAction> | undefined,
  questionUuid: string,
  response: string
) {
  if (!state || !dispatch) {
    return;
  }

  dispatch({type: 'updateResponse'});

  // TODO make actual API call here
  // For now we make a fake response
  console.log('QA fake API call: update response', questionUuid, response);
  setTimeout(() => {
    console.log('QA fake API call: update response DONE');
    dispatch({
      type: 'updateResponseCompleted',
      payload: {
        questions: state.questions.map((item) => {
          if (item.uuid === questionUuid) {
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
