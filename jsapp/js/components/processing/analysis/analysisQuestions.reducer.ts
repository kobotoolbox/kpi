import {generateUid} from 'jsapp/js/utils';
import type {AnalysisQuestion, AnalysisQuestionType} from './constants';

export type AnalysisQuestionsAction =
  | {type: 'addQuestion'; payload: {type: AnalysisQuestionType}}
  | {type: 'deleteQuestion'; payload: {uid: string}}
  | {type: 'startEditingQuestionDefinition'; payload: {uid: string}}
  | {type: 'stopEditingQuestionDefinition'; payload: {uid: string}}
  | {type: 'updateQuestionDefinition'; payload: {uid: string; label: string}}
  | {type: 'updateQuestionResponse'; payload: {uid: string; response: string}};

interface AnalysisQuestionDraftable extends AnalysisQuestion {
  isDraft?: boolean;
}

export interface AnalysisQuestionsState {
  isSaving: boolean;
  questions: AnalysisQuestionDraftable[];
  /**
   * A list of uids of questions with definitions being edited. I.e. whenever
   * project manager starts editing question definition, the uid is being added
   * to this list.
   */
  questionsBeingEdited: string[];
}

// I define this type to ensure that the reducer's returned state always
// matches `AnalysisQuestionsState`.
type AnalysisQuestionReducerType = (
  state: AnalysisQuestionsState,
  action: AnalysisQuestionsAction
) => AnalysisQuestionsState;

export const initialState: AnalysisQuestionsState = {
  isSaving: false,
  questions: [],
  questionsBeingEdited: [],
};

export const analysisQuestionsReducer: AnalysisQuestionReducerType = (
  state: AnalysisQuestionsState,
  action: AnalysisQuestionsAction
) => {
  switch (action.type) {
    // TODO idea: when `addQuestion` is acted we create a "draft" question, one
    // with isDraft:true. When `updateQuestionDefinition` is passed with
    // question that is isDraft:true, we remove it (thus making it not a draft)
    // when `selectQuestionToModifyDefinition` is sent with null, and previous
    // question was isDraft:true, we remove it

    case 'addQuestion': {
      // This is the place that assigns the uid to the question
      const newUid = generateUid();
      return {
        ...state,
        // We add the question at the beginning of the existing array.
        questions: [
          {
            type: action.payload.type,
            label: '',
            uid: newUid,
            response: '',
            isDraft: true,
          },
          ...state.questions,
        ],
        // We immediately open this question for editing
        questionsBeingEdited: [...state.questionsBeingEdited, newUid],
      };
    }
    case 'deleteQuestion': {
      return {
        ...state,
        questions: state.questions.filter(
          (question) => question.uid !== action.payload.uid
        ),
      };
    }
    case 'startEditingQuestionDefinition': {
      return {
        ...state,
        questionsBeingEdited: [
          ...state.questionsBeingEdited,
          action.payload.uid,
        ],
      };
    }
    case 'stopEditingQuestionDefinition': {
      return {
        ...state,
        // If we stop editing a question that was a draft, we need to remove it
        // from the questions list
        questions: state.questions.filter((question) => {
          if (question.uid === action.payload.uid && question.isDraft) {
            return false;
          }
          return true;
        }),
        questionsBeingEdited: state.questionsBeingEdited.filter(
          (uid) => uid !== action.payload.uid
        ),
      };
    }
    case 'updateQuestionDefinition': {
      return {
        ...state,
        // We return the same questions array, just replacing one item (it's
        // the updated question).
        questions: state.questions.map((aq) => {
          if (aq.uid === action.payload.uid) {
            // Successfully updating/saving question makes it not a draft
            delete aq.isDraft;
            return {
              ...aq,
              label: action.payload.label,
            };
          } else {
            return aq;
          }
        }),
        // After question definition was updated, we no longer modify it (this
        // closes the editor)
        questionsBeingEdited: state.questionsBeingEdited.filter(
          (uid) => uid !== action.payload.uid
        ),
      };
    }
  }
  return state;
};
