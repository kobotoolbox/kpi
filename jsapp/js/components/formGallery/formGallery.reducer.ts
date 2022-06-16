import type {SubmissionResponse} from 'js/dataInterface';
import type {FormGalleryAction} from './formGallery.actions';

interface State {
  submissions: SubmissionResponse[];
  isLoading: boolean;
  next: string | null;
  isFullscreen: boolean;
  filterQuestion: string | null;
  startDate: string;
  endDate: string;
}

export const initialState: State = {
  submissions: [],
  isLoading: false,
  next: null,
  isFullscreen: false,
  // Would be nice to move filters to query params
  filterQuestion: null,
  startDate: '',
  endDate: '',
};

export function reducer(state: State, action: FormGalleryAction): State {
  switch (action.type) {
    case 'getSubmissions':
      return {
        ...state,
        isLoading: true,
        submissions: [],
        next: null,
      };
    case 'getSubmissionsCompleted':
      return {
        ...state,
        isLoading: false,
        submissions: action.resp.results,
        next: action.resp.next,
      };
    case 'getSubmissionsFailed':
      return {
        ...state,
        isLoading: false,
      };
    case 'loadMoreSubmissions':
      return {
        ...state,
        isLoading: true
      }
    case 'loadMoreSubmissionsCompleted':
      return {
        ...state,
        isLoading: false,
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
