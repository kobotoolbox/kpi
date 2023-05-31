import {generateUid, moveArrayElementToIndex} from 'jsapp/js/utils';
import type {AnalysisQuestion, AnalysisQuestionType} from './constants';

export type AnalysisQuestionsAction =
  // Creates a draft question of given type with new uid assigned
  | {type: 'addQuestion'; payload: {type: AnalysisQuestionType}}
  // Opens question for editing, i.e. causes the editor to be opened for given
  // question
  | {type: 'startEditingQuestion'; payload: {uid: string}}
  // Closes the editor (and removes the question if it was a draft)
  | {type: 'stopEditingQuestion'; payload: {uid: string}}
  // Immediately removes the question from the local list and blocks the UI,
  // awaiting the API call response.
  | {type: 'deleteQuestion'; payload: {uid: string}}
  // Unlocks UI after successfull API call, updates the questions list with the
  // fresh data from Back-end. It should be identical to the list we already
  // have, but it's still safer to use the fresh data.
  | {type: 'deleteQuestionCompleted'; payload: {questions: AnalysisQuestion[]}}
  // Used for updating the question definition in the editor. It blocks the UI,
  // awaiting the API call response.
  | {type: 'updateQuestion'}
  // Unlocks UI after succcesfull API call, updates the questions list with the
  // fresh data from Back-end.
  | {type: 'updateQuestionCompleted'; payload: {questions: AnalysisQuestion[]}}
  // Used for updating the response to the question. Blocks the UI, awaiting
  // the API call response.
  | {type: 'updateResponse'}
  // Unlocks UI after succcesfull API call, updates the questions list with the
  // fresh data from Back-end.
  | {type: 'updateResponseCompleted'; payload: {questions: AnalysisQuestion[]}}
  // Moves the question in the list, immediately updating the questions array.
  // This action is being called while the question is being dragged (this is
  // how `react-dnd` works). Here we modify the local list, the new order will
  // be sent to Back-end, when user stops dragging. At that point the
  // `applyQuestionsOrder` action will be called.
  | {
      type: 'reorderQuestion';
      payload: {
        uid: string;
        oldIndex: number;
        newIndex: number;
      };
    }
  // Used when user finishes dragging the question. It blocks the UI, awaiting
  // the API call response.
  | {type: 'applyQuestionsOrder'}
  // Unlocks UI after succcesfull API call, updates the questions list with the
  // fresh data from Back-end.
  | {
      type: 'applyQuestionsOrderCompleted';
      payload: {questions: AnalysisQuestion[]};
    }
  // Used when user starts the search for a `qual_keyword_search` question. It
  // blocks the UI, awaiting the API call response.
  | {type: 'initialiseSearch'}
  // Unlocks UI after succcesfull API call, updates the questions list with the
  // fresh data from Back-end.
  | {
      type: 'initialiseSearchCompleted';
      payload: {questions: AnalysisQuestion[]};
    };

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
      };
    }
    case 'applyQuestionsOrder': {
      return {
        ...state,
        isPending: true,
      };
    }
    case 'applyQuestionsOrderCompleted': {
      return {
        ...state,
        isPending: false,
        questions: action.payload.questions,
      };
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
    default: {
      return state;
    }
  }
};
