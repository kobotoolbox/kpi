import type {Action} from './formGallery.actions';

export interface State {
  submissions: SubmissionResponse[];
  loading: boolean;
  next: string | null;
  isFullscreen: boolean;
  filterQuestion: string | null;
  startDate: string;
  endDate: string;
}

export const initialState: State = {
  submissions: [],
  loading: false,
  next: null,
  isFullscreen: false,
  // Would be nice to move filters to query params
  filterQuestion: null,
  startDate: '',
  endDate: '',
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'getSubmissions':
      return {
        ...state,
        loading: true,
        submissions: [],
        next: null,
      };
    case 'getSubmissionsCompleted':
      return {
        ...state,
        loading: false,
        submissions: action.resp.results,
        next: action.resp.next,
      };
    case 'getSubmissionsFailed':
      return {
        ...state,
        loading: false,
      };
    case 'loadMoreSubmissionsCompleted':
      return {
        ...state,
        loading: false,
        submissions: [...state.submissions, ...action.resp.results],
        next: action.resp.next,
      };
    case 'toggleFullscreen':
      return {
        ...state,
        isFullscreen: !state.isFullscreen,
      };
    case 'setFilterQuestion':
      return {
        ...state,
        filterQuestion: action.question,
      };
    case 'setStartDate':
      return {
        ...state,
        startDate: action.value,
      };
    case 'setEndDate':
      return {
        ...state,
        endDate: action.value,
      };
  }
  return state;
}
