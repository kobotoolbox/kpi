import React, {useState, useContext} from 'react';
import Icon from 'js/components/common/icon';
import styles from './analysisQuestionEditor.module.scss';
import TextBox from 'js/components/common/textBox';
import Button from 'js/components/common/button';
import {
  findQuestion,
  getQuestionTypeDefinition,
} from 'js/components/processing/analysis/utils';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import KeywordSearchFieldsEditor from './keywordSearchFieldsEditor.component';

interface DefaultEditorProps {
  uid: string;
}

export default function DefaultEditor(props: DefaultEditorProps) {
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

  const [label, setLabel] = useState<string>(question.label);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  function onTextBoxChange(newLabel: string) {
    setLabel(newLabel);
    if (newLabel !== '' && errorMessage !== undefined) {
      setErrorMessage(undefined);
    }
  }

  function saveQuestion() {
    if (label === '') {
      setErrorMessage(t('Question label cannot be empty'));
    } else {
      analysisQuestions?.dispatch({
        type: 'updateQuestion',
        payload: {
          uid: props.uid,
          label: label,
        },
      });

      // TODO make actual API call here
      // For now we make a fake response
      console.log('QA fake API call: update question');
      setTimeout(() => {
        console.log('QA fake API call: update question DONE');
        analysisQuestions?.dispatch({
          type: 'updateQuestionCompleted',
          payload: {
            // We return the same questions array, just replacing one item (it's
            // the updated question).
            questions: analysisQuestions?.state.questions.map((aq) => {
              if (aq.uid === props.uid) {
                // Successfully updating/saving question makes it not a draft
                delete aq.isDraft;
                return {
                  ...aq,
                  label: label,
                };
              } else {
                return aq;
              }
            }),
          },
        });
      }, 2000);
    }
  }

  function cancelEditing() {
    analysisQuestions?.dispatch({
      type: 'stopEditingQuestion',
      payload: {uid: props.uid},
    });
  }

  return (
    <div>
      <header className={styles.header}>
        <div className={styles.icon}>
          <Icon name={qaDefinition.icon} size='xl' />
        </div>

        <TextBox
          value={label}
          onChange={onTextBoxChange}
          errors={errorMessage}
          placeholder={t('Type question')}
          customModifiers='on-white'
          renderFocused
          disabled={analysisQuestions?.state.isPending}
        />

        <Button
          type='frame'
          color='storm'
          size='m'
          label={t('Save')}
          onClick={saveQuestion}
          isPending={analysisQuestions?.state.isPending}
        />

        <Button
          type='bare'
          color='storm'
          size='m'
          startIcon='close'
          onClick={cancelEditing}
          isDisabled={analysisQuestions?.state.isPending}
        />
      </header>

      {question.type === 'aq_keyword_search' &&
        <KeywordSearchFieldsEditor uid={question.uid} />
      }
    </div>
  );
}
