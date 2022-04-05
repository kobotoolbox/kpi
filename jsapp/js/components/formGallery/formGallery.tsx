import React, {useEffect, useMemo, useReducer} from 'react';
import ReactSelect from 'react-select';
// @ts-ignore
import {dataInterface} from 'js/dataInterface';

interface State {
  submissions: SubmissionResponse[];
  loading: boolean;
  next: string | null;
  filterQuestion: string | null;
}

type Action =
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
  | {type: 'setFilterQuestion'; question: string};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'getSubmissions':
      return {
        ...state,
        loading: true,
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
    case 'setFilterQuestion':
      return {
        ...state,

      }
  }
  return state;
}

const IMAGE_MIMETYPES = [
  'image/png',
  'image/gif',
  'image/jpeg',
  'image/svg+xml',
];

const selectImageAttachments = (submissions: SubmissionResponse[]) =>
  ([] as SubmissionAttachment[]).concat.apply(
    [],
    submissions.map((x) =>
      x._attachments.filter((attachment) =>
        IMAGE_MIMETYPES.includes(attachment.mimetype)
      )
    )
  );

const selectShowLoadMore = (next: string | null) => !!next;

interface FormGalleryProps {
  asset: AssetResponse;
}

export default function FormGallery(props: FormGalleryProps) {
  const questions = props.asset.content?.survey
    ?.filter((survey) => survey.type === 'image')
    .map((survey) => ({
      value: survey.$autoname,
      label: survey.label?.join('') || '',
    }));
  const defaultOption = {value: '', label: 'All questions'};
  const questionFilterOptions = [defaultOption, ...(questions || [])];
  const [{submissions, next}, dispatch] = useReducer(reducer, {
    loading: false,
    submissions: [],
    next: null,
    filterQuestion: null
  });
  const attachments = useMemo(
    () => selectImageAttachments(submissions),
    [submissions]
  );
  const showLoadMore = useMemo(() => selectShowLoadMore(next), [next]);
  useEffect(() => {
    dispatch({type: 'getSubmissions'});
    dataInterface
      .getSubmissions(props.asset.uid, 3)
      .done((resp: PaginatedResponse<SubmissionResponse>) =>
        dispatch({type: 'getSubmissionsCompleted', resp})
      );
  }, []);

  const loadMoreSubmissions = () => {
    if (next) {
      // getSubmissions incorrectly considers start to be page (it's an offset)
      // The needed start offset is already in the next state, extract it
      const start = new URL(next).searchParams.get('start');
      if (start) {
        dispatch({type: 'loadMoreSubmissions'});
        dataInterface
          .getSubmissions(props.asset.uid, 3, start)
          .done((resp: PaginatedResponse<SubmissionResponse>) =>
            dispatch({type: 'loadMoreSubmissionsCompleted', resp})
          );
      }
    }
  };

  const filterQuestionChange = (newValue: any) => {
    console.log(newValue);
    // Maybe put filter value in query params here instead of state
  }

  return (
    <div className='form-view'>
      <h1>Image Gallery</h1>
      From:{' '}
      <ReactSelect
        options={questionFilterOptions}
        defaultValue={defaultOption}
        onChange={filterQuestionChange}
      ></ReactSelect>
      {attachments.map((attachment) => (
        <div key={attachment.id}>
          <img
            src={attachment.download_url}
            alt={attachment.filename}
            width='300'
            loading='lazy'
          ></img>
        </div>
      ))}
      {showLoadMore && (
        <button onClick={() => loadMoreSubmissions()}>Show more</button>
      )}
    </div>
  );
}
