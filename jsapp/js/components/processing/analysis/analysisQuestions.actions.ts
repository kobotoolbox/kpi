import type {
  AnalysisQuestionInternal,
  AnalysisQuestionType,
  SubmissionProcessingDataResponse,
} from './constants';

export type AnalysisQuestionsAction =
  // Sets all the quetsion with new ones (useful for initialising)
  | {type: 'setQuestions'; payload: {questions: AnalysisQuestionInternal[]}}
  // Creates a draft question of given type with new uid assigned
  | {type: 'addQuestion'; payload: {xpath: string; type: AnalysisQuestionType}}
  // Opens question for editing, i.e. causes the editor to be opened for given
  // question
  | {type: 'startEditingQuestion'; payload: {uuid: string}}
  // Closes the editor (and removes the question if it was a draft)
  | {type: 'stopEditingQuestion'; payload: {uuid: string}}
  // Immediately removes the question from the local list and blocks the UI,
  // awaiting the API call response.
  | {type: 'deleteQuestion'; payload: {uuid: string}}
  // Unlocks UI after successfull API call, updates the questions list with the
  // fresh data from Back-end. It should be identical to the list we already
  // have, but it's still safer to use the fresh data.
  | {
      type: 'deleteQuestionCompleted';
      payload: {questions: AnalysisQuestionInternal[]};
    }
  // Used for updating the question definition in the editor. It blocks the UI,
  // awaiting the API call response.
  | {type: 'updateQuestion'}
  // Unlocks UI after succcesfull API call, updates the questions list with the
  // fresh data from Back-end.
  | {
      type: 'updateQuestionCompleted';
      payload: {question: AnalysisQuestionInternal};
    }
  // Unlocks UI after failed API call
  | {type: 'udpateQuestionFailed'}
  // Used for updating the response to the question. Blocks the UI, awaiting
  // the API call response.
  | {type: 'updateResponse'}
  // Unlocks UI after succcesfull API call, updates the questions list with the
  // fresh data from Back-end.
  | {
      type: 'updateResponseCompleted';
      payload: {
        xpath: string;
        apiResponse: SubmissionProcessingDataResponse;
      };
    }
  // Unlocks UI after failed API call
  | {type: 'updateResponseFailed'}
  // Moves the question in the list, immediately updating the questions array.
  // This action is being called while the question is being dragged (this is
  // how `react-dnd` works). Here we modify the local list, the new order will
  // be sent to Back-end, when user stops dragging. At that point the
  // `applyQuestionsOrder` action will be called.
  | {
      type: 'reorderQuestion';
      payload: {
        uuid: string;
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
      payload: {questions: AnalysisQuestionInternal[]};
    }
  // Unlocks UI after failed API call
  | {type: 'applyQuestionsOrderFailed'}
  // Used when user starts the search for a `qual_keyword_search` question. It
  // blocks the UI, awaiting the API call response.
  | {type: 'initialiseSearch'}
  // Unlocks UI after succcesfull API call, updates the questions list with the
  // fresh data from Back-end.
  | {
      type: 'initialiseSearchCompleted';
      payload: {questions: AnalysisQuestionInternal[]};
    }
  // There exist changes in frontend that differes from backend.
  | {
      type: 'hasUnsavedWork';
    };
