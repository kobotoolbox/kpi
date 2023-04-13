import React, {useState} from 'react';
import AnalysisQuestionEditor from './analysisQuestionEditor.component';
import AnalysisQuestionForm from './analysisQuestionForm.component';
import type {AnalysisQuestion} from './constants';

interface AnalysisQuestionsListProps {
  questions: AnalysisQuestion[];
}

export default function AnalysisQuestionsList(props: AnalysisQuestionsListProps) {
  /** Used for opening the editor for a single question. */
  const [beingModifiedUid, setBeingModifiedUid] = useState<string | undefined>();

  return (
    <ul>
      <li>beingModifiedUid: {beingModifiedUid}</li>
      {props.questions.map((question) => (
        <li key={question.uid}>
          {question.uid === beingModifiedUid &&
            <AnalysisQuestionEditor
              type={question.type}
              label={question.label}
              uid={question.uid}
              onSave={(uid: string, newLabel: string) => {
                console.log('onSave', uid, newLabel);
                question.label = newLabel;
                setBeingModifiedUid(undefined);
              }}
              onCancel={() => setBeingModifiedUid(undefined)}
            />
          }
          {question.uid !== beingModifiedUid &&
            <AnalysisQuestionForm
              type={question.type}
              label={question.label}
              uid={question.uid}
              response={question.response}
              onSave={(uid: string, newResponse: string) => {
                console.log('onSave', uid, newResponse);
              }}
              onRequestEditing={setBeingModifiedUid}
              isEditDisabled={beingModifiedUid !== undefined}
            />
          }
        </li>
      ))}
    </ul>
  );
}
