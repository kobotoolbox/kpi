import type { SubmissionResponse } from '#/dataInterface'
import type { FormGalleryAction } from './formGallery.actions'

interface State {
  submissions: SubmissionResponse[]
  /** Total count of submissions (from API), not total count of currently loaded submissions */
  totalSubmissions: number
  isLoading: boolean
  next: string | null
  isFullscreen: boolean
  filterQuestion: string | null
  startDate: string
  endDate: string
  isModalOpen: boolean
  currentModalImageIndex: number
}

export const initialState: State = {
  submissions: [],
  totalSubmissions: 0,
  isLoading: false,
  next: null,
  isFullscreen: false,
  // Would be nice to move filters to query params
  filterQuestion: null,
  startDate: '',
  endDate: '',
  isModalOpen: false,
  currentModalImageIndex: 0,
}

export function reducer(state: State, action: FormGalleryAction): State {
  switch (action.type) {
    case 'getSubmissions':
      return {
        ...state,
        isLoading: true,
        submissions: [],
        totalSubmissions: 0,
        next: null,
        isModalOpen: false,
      }
    case 'getSubmissionsCompleted':
      return {
        ...state,
        isLoading: false,
        submissions: action.resp.results,
        totalSubmissions: action.resp.count,
        next: action.resp.next,
      }
    case 'getSubmissionsFailed':
      return {
        ...state,
        isLoading: false,
      }
    case 'loadMoreSubmissions':
      return {
        ...state,
        isLoading: true,
      }
    case 'loadMoreSubmissionsCompleted':
      return {
        ...state,
        isLoading: false,
        submissions: [...state.submissions, ...action.resp.results],
        next: action.resp.next,
      }
    case 'toggleFullscreen':
      return {
        ...state,
        isFullscreen: !state.isFullscreen,
      }
    case 'setFilterQuestion':
      return {
        ...state,
        filterQuestion: action.question,
        isModalOpen: false,
      }
    case 'setStartDate':
      return {
        ...state,
        startDate: action.value,
        isModalOpen: false,
      }
    case 'setEndDate':
      return {
        ...state,
        endDate: action.value,
        isModalOpen: false,
      }
    case 'openModal':
      return {
        ...state,
        isModalOpen: true,
        currentModalImageIndex: action.index,
      }
    case 'closeModal':
      return {
        ...state,
        isModalOpen: false,
      }
    case 'setModalImageIndex':
      return {
        ...state,
        currentModalImageIndex: action.index,
      }
  }
  return state
}
