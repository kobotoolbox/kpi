import React, {useContext, useState} from 'react';
import CommonHeader from './commonHeader.component';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import {
  findQuestion,
  getQuestionTypeDefinition,
  quietlyUpdateResponse,
} from 'js/components/processing/analysis/utils';
import TagsInput from 'react-tagsinput';
import commonStyles from './common.module.scss';

interface TagsResponseFormProps {
  uuid: string;
}

export default function TagsResponseForm(props: TagsResponseFormProps) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);
  if (!analysisQuestions) {
    return null;
  }

  // Get the question data from state (with safety check)
  const question = findQuestion(props.uuid, analysisQuestions.state);
  if (!question) {
    return null;
  }

  // Get the question definition (with safety check)
  const qaDefinition = getQuestionTypeDefinition(question.type);
  if (!qaDefinition) {
    return null;
  }

  const [response, setResponse] = useState<string>(question.response);

  function getTags() {
    if (response?.length !== 0) {
      return response.split(',');
    }
    return [];
  }

  function onTagsChange(newTags: string[]) {
    const newResponse = newTags.join(',');

    setResponse(newResponse);

    quietlyUpdateResponse(
      analysisQuestions?.state,
      analysisQuestions?.dispatch,
      props.uuid,
      newResponse
    );
  }

  return (
    <>
      <CommonHeader uuid={props.uuid} />

      <section className={commonStyles.content}>
        <TagsInput
          value={getTags()}
          onChange={onTagsChange}
          onlyUnique
          addOnBlur
          addOnPaste
        />
      </section>
    </>
  );
}
