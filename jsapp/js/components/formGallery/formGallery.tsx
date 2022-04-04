import React, {useEffect, useMemo, useReducer} from 'react';
// @ts-ignore
import {dataInterface} from 'js/dataInterface';

interface State {
  submissions: SubmissionResponse[];
  loading: boolean;
}

type Action =
  | {type: 'getSubmissions'}
  | {type: 'getSubmissionsCompleted'; results: SubmissionResponse[]}
  | {type: 'getSubmissionsFailed'};

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
        submissions: action.results,
      };
    case 'getSubmissionsFailed':
      return {
        ...state,
        loading: false,
      };
  }
}

const selectAttachments = (submissions: SubmissionResponse[]) =>
  ([] as SubmissionAttachment[]).concat.apply(
    [],
    submissions.map((x) => x._attachments)
  );

export default function FormGallery() {
  const [{submissions, loading}, dispatch] = useReducer(reducer, {
    loading: false,
    submissions: [],
  });
  const attachments = useMemo(
    () => selectAttachments(submissions),
    [submissions]
  );
  useEffect(() => {
    dispatch({type: 'getSubmissions'});
    dataInterface
      .getSubmissions('ajGgwzZb2f6vcE2ho6Fyyv')
      .done((resp: any) =>
        dispatch({type: 'getSubmissionsCompleted', results: resp.results})
      );
  }, []);

  return (
    <div>
      Gallery!
      {attachments.map((attachment) => (
        <span key={attachment.id}>{attachment.filename}</span>
      ))}
    </div>
  );
}

// More minimalist example
// export default function FormGallery() {
//   const [submissions, setSubmissions] = useState<SubmissionResponse[]>([]);
//   useEffect(() => {
//     dataInterface.getSubmissions(
//       "ajGgwzZb2f6vcE2ho6Fyyv"
//     ).done((x: any) => setSubmissions(x.results))
//   }, [])
//   return(
//     <div>
//       Hello!
//       {submissions.map((submission) => (
//         <span>{ submission._uuid }</span>
//       ))}
//     </div>
//   )
// }
