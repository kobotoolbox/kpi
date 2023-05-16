import React, {useContext} from 'react';
import styles from './selectXFieldsEditor.module.scss';
import type {AdditionalFields} from 'js/components/processing/analysis/constants';
import Button from 'js/components/common/button';
import {generateUid} from 'js/utils';
import TextBox from 'jsapp/js/components/common/textBox';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';

interface SelectXFieldsEditorProps {
  uid: string;
  fields: AdditionalFields;
  onFieldsChange: (fields: AdditionalFields) => void;
}

export default function SelectXFieldsEditor(props: SelectXFieldsEditorProps) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);

  function updateChoiceLabel(uid: string, newLabel: string) {
    props.onFieldsChange({
      choices: (props.fields.choices || []).map((choice) => {
        if (choice.uid === uid) {
          return {
            ...choice,
            label: newLabel,
          };
        } else {
          return choice;
        }
      }),
    });
  }

  function addChoice() {
    props.onFieldsChange({
      choices: [
        ...(props.fields.choices || []),
        {
          uid: generateUid(),
          label: '',
        },
      ],
    });
  }

  function deleteChoice(uid: string) {
    props.onFieldsChange({
      choices: (props.fields.choices || []).filter(
        (choice) => choice.uid !== uid
      ),
    });
  }

  return (
    <>
      {props.fields.choices?.map((choice) => (
        <div className={styles.choice} key={choice.uid}>
          <TextBox
            type='text-multiline'
            value={choice.label}
            onChange={(newLabel: string) =>
              updateChoiceLabel(choice.uid, newLabel)
            }
            placeholder={t('Type option name')}
            customModifiers='on-white'
            renderFocused
            disabled={analysisQuestions?.state.isPending}
          />

          <Button
            type='bare'
            color='storm'
            size='s'
            startIcon='trash'
            onClick={() => deleteChoice(choice.uid)}
            isDisabled={analysisQuestions?.state.isPending}
          />
        </div>
      ))}

      <div className={styles.addOption}>
        <Button
          type='full'
          color='light-blue'
          size='s'
          startIcon='plus'
          label={t('Add new option')}
          onClick={addChoice}
          isDisabled={analysisQuestions?.state.isPending}
        />
      </div>
    </>
  );
}
