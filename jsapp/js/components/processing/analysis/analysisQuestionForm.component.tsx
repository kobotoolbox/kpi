import React, {useState} from 'react';
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import TextBox from 'js/components/common/textBox';
import type {AnalysisQuestionType} from './constants';
import {ANALYSIS_QUESTION_DEFINITIONS} from './constants';

interface AnalysisQuestionFormProps {
  type: AnalysisQuestionType;
  label: string;
  uid: string;
  response: string;
  onSave: (uid: string, newResponse: string) => void;
  /**
   * Means that user clicked "Edit" button and wants to start modyfing
   * the question definition.
   */
  onRequestEditing: (uid: string) => void;
  isEditDisabled?: boolean;
}

/**
 * A component responsible for displaying an interactive form for user to
 * respond to given analysis question or to modify existing response.
 */
export default function AnalysisQuestionForm(props: AnalysisQuestionFormProps) {
  const [response, setResponse] = useState<string>(props.response);

  const qaDefinition = ANALYSIS_QUESTION_DEFINITIONS[props.type];

  function onTextboxBlur() {
    console.log('onTextboxBlur');
  }

  return (
    <div style={{border: '1px solid black', padding: '10px'}}>
      <Icon name={qaDefinition.icon} size='m' />

      <h2>{props.label}</h2>

      <TextBox
        value={response}
        onChange={setResponse}
        placeholder={t('Start typing your answer')}
        onBlur={onTextboxBlur}
      />

      <Button
        type='bare'
        color='storm'
        size='s'
        startIcon='edit'
        onClick={() => props.onRequestEditing(props.uid)}
        isDisabled={props.isEditDisabled}
      />
    </div>
  );
}
