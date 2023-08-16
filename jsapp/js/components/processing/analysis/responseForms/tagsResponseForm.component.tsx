import React, {useContext, useState} from 'react';
import CommonHeader from './commonHeader.component';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import {
  findQuestion,
  getQuestionTypeDefinition,
  updateResponseAndReducer,
} from 'js/components/processing/analysis/utils';
import TagsInput from 'react-tagsinput';
import commonStyles from './common.module.scss';

interface TagsResponseFormProps {
  uuid: string;
}

export default function TagsResponseForm(props: TagsResponseFormProps) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  // Get the question data from state (with safety check)
  const question = findQuestion(props.uuid, analysisQuestions?.state);
  if (!question) {
    return null;
  }

  // Get the question definition (with safety check)
  const qaDefinition = getQuestionTypeDefinition(question.type);
  if (!qaDefinition) {
    return null;
  }

  // This will either be an existing list of tags, or an empty list.
  const initialResponse = Array.isArray(question.response) ? question.response : [];

  const [response, setResponse] = useState<string[]>(initialResponse);

  function onTagsChange(newTags: string[]) {
    // Update local state
    setResponse(newTags);

    // Update endpoint and reducer
    updateResponseAndReducer(
      analysisQuestions?.dispatch,
      props.uuid,
      question?.type,
      newTags
    );
  }

  return (
    <>
      <CommonHeader uuid={props.uuid} />

      <section className={commonStyles.content}>
        <TagsInput
          value={response}
          onChange={onTagsChange}
          onlyUnique
          addOnBlur
          addOnPaste
          disabled={analysisQuestions?.state.isPending}
        />
      </section>
    </>
  );
}
