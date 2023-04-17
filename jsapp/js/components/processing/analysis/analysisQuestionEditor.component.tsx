import React, {useState, useContext} from 'react';
import Icon from 'js/components/common/icon';
import styles from './analysisQuestionEditor.module.scss';
import {ANALYSIS_QUESTION_DEFINITIONS} from './constants';
import TextBox from 'js/components/common/textBox';
import Button from 'js/components/common/button';
import {findQuestion} from './analysisQuestions.utils';
import AnalysisQuestionsContext from './analysisQuestions.context';

interface AnalysisQuestionEditorProps {
  uid: string;
}

export default function AnalysisQuestionEditor(
  props: AnalysisQuestionEditorProps
) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  const question = findQuestion(props.uid, analysisQuestions?.state);

  if (!question) {
    return null;
  }

  // TODO: upon initial rendering we need to set focus on the input

  const [label, setLabel] = useState<string>(question.label);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const qaDefinition = ANALYSIS_QUESTION_DEFINITIONS[question.type];

  function onTextBoxChange(newLabel: string) {
    setLabel(newLabel);
    if (newLabel !== '' && errorMessage !== undefined) {
      setErrorMessage(undefined);
    }
  }

  function onSave() {
    if (label === '') {
      setErrorMessage(t('Question label cannot be empty'));
    } else {
      analysisQuestions?.dispatch({
        type: 'updateQuestionDefinition',
        payload: {
          uid: props.uid,
          label: label,
        },
      });
    }
  }

  function onCancel() {
    analysisQuestions?.dispatch({
      type: 'stopEditingQuestionDefinition',
      payload: {uid: props.uid},
    });
  }

  return (
    <div className={styles.root}>
      <div className={styles.icon}>
        <Icon name={qaDefinition.icon} size='xl' />
      </div>

      <TextBox
        value={label}
        onChange={onTextBoxChange}
        errors={errorMessage}
        placeholder={t('Type question')}
        customModifiers='on-white'
      />

      <Button
        type='frame'
        color='storm'
        size='m'
        label={t('Save')}
        onClick={onSave}
      />

      <Button
        type='bare'
        color='storm'
        size='m'
        startIcon='close'
        onClick={onCancel}
      />
    </div>
  );
}
