import type {
  SubmissionResponse,
  PaginatedResponse,
} from 'js/dataInterface';

export type FormGalleryAction =
  | {
      type: 'getSubmissionsCompleted';
      resp: PaginatedResponse<SubmissionResponse>;
    }
  | {
      type: 'loadMoreSubmissionsCompleted';
      resp: PaginatedResponse<SubmissionResponse>;
    }
  | {type: 'getSubmissions'}
  | {type: 'getSubmissionsFailed'}
  | {type: 'loadMoreSubmissions'}
  | {type: 'loadMoreSubmissionsFailed'}
  | {type: 'setEndDate'; value: string}
  | {type: 'setFilterQuestion'; question: string}
  | {type: 'setStartDate'; value: string}
  | {type: 'toggleFullscreen'};
