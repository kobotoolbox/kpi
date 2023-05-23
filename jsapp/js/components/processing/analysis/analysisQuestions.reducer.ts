import {generateUid, moveArrayElementToIndex} from 'jsapp/js/utils';
import type {
  AnalysisQuestion,
  AnalysisQuestionType,
  AdditionalFields,
} from './constants';

export type AnalysisQuestionsAction =
  | {type: 'addQuestion'; payload: {type: AnalysisQuestionType}}
  | {type: 'startEditingQuestion'; payload: {uid: string}}
  | {type: 'stopEditingQuestion'; payload: {uid: string}}
  | {type: 'deleteQuestion'; payload: {uid: string}}
  | {type: 'deleteQuestionCompleted'; payload: {questions: AnalysisQuestion[]}}
  | {
      type: 'updateQuestion';
      payload: {
        uid: string;
        label: string;
        additionalFields?: AdditionalFields;
      };
    }
  | {type: 'updateQuestionCompleted'; payload: {questions: AnalysisQuestion[]}}
  | {type: 'updateResponse'; payload: {uid: string; response: string}}
  | {type: 'updateResponseCompleted'; payload: {questions: AnalysisQuestion[]}}
  | {type: 'reorderQuestion'; payload: {uid: string; oldIndex: number; newIndex: number}}
  | {type: 'initialiseSearch'; payload: {uid: string}}
  | {type: 'initialiseSearchCompleted'; payload: {questions: AnalysisQuestion[]}};

interface AnalysisQuestionDraftable extends AnalysisQuestion {
  isDraft?: boolean;
}

export interface AnalysisQuestionsState {
  /** Whether any async action is being done right now. */
  isPending: boolean;
  questions: AnalysisQuestionDraftable[];
  /**
   * A list of uids of questions with definitions being edited. I.e. whenever
   * project manager starts editing question definition, the uid is being added
   * to this list.
   */
  questionsBeingEdited: string[];
  /**
   * An ordererd list of uids of questions.
   *
   * When user is not reordering questions, this list doesn't exist. The purpose
   * of it is to avoid unnecessary API calls during reordering - we make single
   * call on reordering end.
   */
  draftQuestionsOrder?: string[];
}

// I define this type to ensure that the reducer's returned state always
// matches `AnalysisQuestionsState`.
type AnalysisQuestionReducerType = (
  state: AnalysisQuestionsState,
  action: AnalysisQuestionsAction
) => AnalysisQuestionsState;

export const initialState: AnalysisQuestionsState = {
  isPending: false,
  questions: [],
  questionsBeingEdited: [],
};

export const analysisQuestionsReducer: AnalysisQuestionReducerType = (
  state: AnalysisQuestionsState,
  action: AnalysisQuestionsAction
) => {
  switch (action.type) {
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
            // Note: initially the question is being added as a draft. It
            // wouldn't be stored in database until user saves it intentionally.
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
        isPending: true,
        // Here we immediately remove the question from the list and wait for
        // a successful API call that will return new questions list (without
        // the deleted question).
        questions: state.questions.filter(
          (question) => question.uid !== action.payload.uid
        ),
      };
    }
    case 'deleteQuestionCompleted': {
      return {
        ...state,
        isPending: false,
        questions: action.payload.questions,
      };
    }
    case 'startEditingQuestion': {
      return {
        ...state,
        questionsBeingEdited: [
          ...state.questionsBeingEdited,
          action.payload.uid,
        ],
      };
    }
    case 'stopEditingQuestion': {
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
    case 'updateQuestion': {
      return {
        ...state,
        isPending: true,
      };
    }
    case 'updateQuestionCompleted': {
      return {
        ...state,
        isPending: false,
        questions: action.payload.questions,
        // After question definition was updated, we no longer modify it (this
        // closes the editor)
        // Note: this assumes we are only allowing one question editor at a time
        questionsBeingEdited: [],
      };
    }
    case 'updateResponse': {
      return {
        ...state,
        isPending: true,
      };
    }
    case 'updateResponseCompleted': {
      return {
        ...state,
        isPending: false,
        questions: action.payload.questions,
      };
    }
    case 'reorderQuestion': {
      return {
        ...state,
        questions: moveArrayElementToIndex(
          state.questions,
          action.payload.oldIndex,
          action.payload.newIndex
        ),
      }
    }
    case 'initialiseSearch': {
      return {
        ...state,
        isPending: true,
      };
    }
    case 'initialiseSearchCompleted': {
      return {
        ...state,
        isPending: false,
        questions: action.payload.questions,
      };
    }
  }
  return state;
};
