export type Action =
  | {type: 'getSubmissions'}
  | {
      type: 'getSubmissionsCompleted';
      resp: PaginatedResponse<SubmissionResponse>;
    }
  | {type: 'getSubmissionsFailed'}
  | {type: 'loadMoreSubmissions'}
  | {
      type: 'loadMoreSubmissionsCompleted';
      resp: PaginatedResponse<SubmissionResponse>;
    }
  | {type: 'loadMoreSubmissionsFailed'}
  | {type: 'toggleFullscreen'}
  | {type: 'setFilterQuestion'; question: string}
  | {type: 'setStartDate'; value: string}
  | {type: 'setEndDate'; value: string};


