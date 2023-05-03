import React, {useContext, useState} from 'react';
import CommonHeader from './commonHeader.component';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import {findQuestion, getQuestionTypeDefinition} from 'js/components/processing/analysis/utils';
import TagsInput from 'react-tagsinput';
import commonStyles from './common.module.scss';
// import styles from './tagsResponseForm.module.scss';

interface TagsResponseFormProps {
  uid: string;
}

export default function TagsResponseForm(props: TagsResponseFormProps) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  // Get the question data from state (with safety check)
  const question = findQuestion(props.uid, analysisQuestions?.state);
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
    setResponse(newTags.join(','));
  }

  return (
    <>
      <CommonHeader uid={props.uid}/>

      <section className={commonStyles.alignedContent}>
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
