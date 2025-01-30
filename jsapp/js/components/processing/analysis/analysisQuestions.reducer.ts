import {generateUuid, moveArrayElementToIndex} from 'jsapp/js/utils';
import type {AnalysisQuestionInternal} from './constants';
import type {AnalysisQuestionsAction} from './analysisQuestions.actions';
import {
  applyUpdateResponseToInternalQuestions,
  updateSingleQuestionPreservingResponse,
} from './utils';

export interface AnalysisQuestionsState {
  /** Whether any async action is being done right now. */
  isPending: boolean;
  /**
   * It's true if user has made a change in the UI and the Back end has not been
   * updated yet. Every completed call to API will change it back to false.
   */
  hasUnsavedWork: boolean;
  questions: AnalysisQuestionInternal[];
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
   * call on reordering end (see `applyQuestionsOrderCompleted` action).
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
  hasUnsavedWork: false,
  questions: [],
  questionsBeingEdited: [],
};

/**
 * This reducer holds all data related to Qualitative Analysis Questions - both
 * the definitions and the responses (merged together for simplicity).
 */
export const analysisQuestionsReducer: AnalysisQuestionReducerType = (
  state: AnalysisQuestionsState,
  action: AnalysisQuestionsAction
) => {
  switch (action.type) {
    case 'setQuestions': {
      return {
        ...state,
        questions: action.payload.questions,
      };
    }
    case 'addQuestion': {
      // This is the place that assigns the uid to the question
      const newUuid = generateUuid();

      let initialResponse: string | string[] = '';
      if (
        action.payload.type === 'qual_tags' ||
        action.payload.type === 'qual_select_multiple'
      ) {
        initialResponse = [];
      }

      const newQuestion: AnalysisQuestionInternal = {
        xpath: action.payload.xpath,
        type: action.payload.type,
        labels: {_default: ''},
        uuid: newUuid,
        response: initialResponse,
        // Note: initially the question is being added as a draft. It
        // wouldn't be stored in database until user saves it intentionally.
        isDraft: true,
      };

      return {
        ...state,
        // We add the question at the beginning of the existing array.
        questions: [newQuestion, ...state.questions],
        // We immediately open this question for editing
        questionsBeingEdited: [...state.questionsBeingEdited, newUuid],
        hasUnsavedWork: true,
      };
    }
    case 'deleteQuestion': {
      return {
        ...state,
        isPending: true,
        hasUnsavedWork: true,
        // Here we immediately mark the question as `deleted` and wait for
        // a successful API call that will return new questions list (to ensure
        // the deletion went as expected).
        questions: state.questions.map((question) => {
          if (question.uuid === action.payload.uuid) {
            if (typeof question.options !== 'object') {
              question.options = {};
            }
            question.options.deleted = true;
          }
          return question;
        }),
      };
    }
    case 'deleteQuestionCompleted': {
      return {
        ...state,
        isPending: false,
        hasUnsavedWork: false,
        questions: action.payload.questions,
      };
    }
    case 'startEditingQuestion': {
      return {
        ...state,
        // Instead of checking changes on every input in the edited question,
        // we assume that, as soon as user starts to edit a question, there are
        // unsaved changes. This is not ideal UX, but it's much simpler and
        // still logical.
        hasUnsavedWork: true,
        questionsBeingEdited: [
          ...state.questionsBeingEdited,
          action.payload.uuid,
        ],
      };
    }
    case 'stopEditingQuestion': {
      return {
        ...state,
        // If we stop editing a question that was a draft, we need to remove it
        // from the questions list
        hasUnsavedWork: false,
        questions: state.questions.filter((question) => {
          if (question.uuid === action.payload.uuid && question.isDraft) {
            return false;
          }
          return true;
        }),
        questionsBeingEdited: state.questionsBeingEdited.filter(
          (uid) => uid !== action.payload.uuid
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
        hasUnsavedWork: false,
        questions: updateSingleQuestionPreservingResponse(
          action.payload.question,
          state.questions
        ),
        // After question definition was updated, we no longer modify it (this
        // closes the editor)
        // Note: this assumes we are only allowing one question editor at a time
        questionsBeingEdited: [],
      };
    }
    case 'udpateQuestionFailed': {
      return {
        ...state,
        isPending: false,
      };
    }
    case 'updateResponse': {
      return {
        ...state,
        isPending: true,
        hasUnsavedWork: true,
      };
    }
    case 'updateResponseCompleted': {
      const newQuestions = applyUpdateResponseToInternalQuestions(
        action.payload.xpath,
        action.payload.apiResponse,
        state.questions
      );

      return {
        ...state,
        isPending: false,
        hasUnsavedWork: false,
        questions: newQuestions,
      };
    }
    case 'updateResponseFailed': {
      return {
        ...state,
        isPending: false,
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
        hasUnsavedWork: true,
      };
    }
    case 'applyQuestionsOrderCompleted': {
      return {
        ...state,
        isPending: false,
        hasUnsavedWork: false,
        questions: action.payload.questions,
      };
    }
    case 'applyQuestionsOrderFailed': {
      return {
        ...state,
        isPending: false,
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
        hasUnsavedWork: false,
        questions: action.payload.questions,
      };
    }
    case 'hasUnsavedWork': {
      return {
        ...state,
        hasUnsavedWork: true,
      };
    }
    default: {
      return state;
    }
  }
};
