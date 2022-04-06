import React, {useEffect, useMemo, useReducer} from 'react';
import ReactSelect from 'react-select';
// @ts-ignore
import {dataInterface} from 'js/dataInterface';

interface State {
  submissions: SubmissionResponse[];
  loading: boolean;
  next: string | null;
  filterQuestion: string | null;
  startDate: string;
  endDate: string;
}

const initialState: State = {
  loading: false,
  submissions: [],
  next: null,
  // Would be nice to move filters to query params
  filterQuestion: null,
  startDate: '',
  endDate: '',
};

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
  | {type: 'setFilterQuestion'; question: string}
  | {type: 'setStartDate'; value: string}
  | {type: 'setEndDate'; value: string};

function reducer(state: State, action: Action): State {
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
    case 'setFilterQuestion':
      return {
        ...state,
        filterQuestion: action.question,
      };
    case 'setStartDate':
      console.log(action.value);
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

const IMAGE_MIMETYPES = [
  'image/png',
  'image/gif',
  'image/jpeg',
  'image/svg+xml',
];
const PAGE_SIZE = 30;

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
const selectFilterQuery = (
  filterQuestion: string | null,
  startDate: string,
  endDate: string
) => {
  console.log(startDate, endDate);
  let query = '';
  if (filterQuestion) {
    const filterQuery = {[filterQuestion]: {$exists: true}};
    query = '&query=' + JSON.stringify(filterQuery);
  }
  return query;
};

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
  const [{submissions, next, filterQuestion, startDate, endDate}, dispatch] =
    useReducer(reducer, initialState);

  const attachments = useMemo(
    () => selectImageAttachments(submissions),
    [submissions]
  );
  const showLoadMore = useMemo(() => selectShowLoadMore(next), [next]);
  const filterQuery = useMemo(
    () => selectFilterQuery(filterQuestion, startDate, endDate),
    [filterQuestion, startDate, endDate]
  );

  useEffect(() => {
    dispatch({type: 'getSubmissions'});
    dataInterface
      .getSubmissions(props.asset.uid, PAGE_SIZE, 0, [], [], filterQuery)
      .done((resp: PaginatedResponse<SubmissionResponse>) =>
        dispatch({type: 'getSubmissionsCompleted', resp})
      );
  }, [filterQuestion, startDate, endDate]);

  const loadMoreSubmissions = () => {
    if (next) {
      // The needed start offset is already in the next state, extract it
      const start = new URL(next).searchParams.get('start');
      if (start) {
        dispatch({type: 'loadMoreSubmissions'});

        dataInterface
          .getSubmissions(
            props.asset.uid,
            PAGE_SIZE,
            start,
            [],
            [],
            filterQuery
          )
          .done((resp: PaginatedResponse<SubmissionResponse>) =>
            dispatch({type: 'loadMoreSubmissionsCompleted', resp})
          );
      }
    }
  };

  return (
    <div className='form-view'>
      <h1>Image Gallery</h1>
      From:
      <ReactSelect
        options={questionFilterOptions}
        defaultValue={defaultOption}
        onChange={(newValue) =>
          dispatch({type: 'setFilterQuestion', question: newValue!.value})
        }
      ></ReactSelect>
      Between
      <input
        type='date'
        onChange={(e) =>
          dispatch({type: 'setStartDate', value: e.target.value})
        }
      ></input>
      and
      <input
        type='date'
        onChange={(e) => dispatch({type: 'setEndDate', value: e.target.value})}
      ></input>
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
