import React, {useState} from 'react';
import Icon from 'js/components/common/icon';
import styles from './analysisQuestionEditor.module.scss';
import type {AnalysisQuestionType} from './constants';
import {ANALYSIS_QUESTION_DEFINITIONS} from './constants';
import TextBox from 'js/components/common/textBox';
import Button from 'js/components/common/button';

interface AnalysisQuestionEditorProps {
  type: AnalysisQuestionType;
  label: string;
  uid: string;
  onSave: (uid: string, newLabel: string) => void;
  onCancel: () => void;
}

export default function AnalysisQuestionEditor(props: AnalysisQuestionEditorProps) {
  const [label, setLabel] = useState<string>(props.label);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const qaDefinition = ANALYSIS_QUESTION_DEFINITIONS[props.type];

  function onSave() {
    if (label === '') {
      setErrorMessage(t('Question label cannot be empty'));
    } else {
      props.onSave(props.uid, label);
    }
  }

  return (
    <div className={styles.root}>
      <Icon name={qaDefinition.icon} size='m' />

      <TextBox
        value={label}
        onChange={setLabel}
        errors={errorMessage}
        placeholder={t('Type question')}
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
        onClick={props.onCancel}
      />
    </div>
  );
}
