import React, {useContext} from 'react';
import styles from './selectXFieldsEditor.module.scss';
import type {AdditionalFields} from 'js/components/processing/analysis/constants';
import Button from 'js/components/common/button';
import {generateUuid} from 'js/utils';
import TextBox from 'jsapp/js/components/common/textBox';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';

interface SelectXFieldsEditorProps {
  uuid: string;
  fields: AdditionalFields;
  onFieldsChange: (fields: AdditionalFields) => void;
}

/**
 * Displays a form for creating choices for "select x" question types. We only
 * expose editing the choice label to users - the uuid is pregenerated.
 */
export default function SelectXFieldsEditor(props: SelectXFieldsEditorProps) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);
  if (!analysisQuestions) {
    return null;
  }

  function updateChoiceLabel(uuid: string, newLabel: string) {
    props.onFieldsChange({
      choices: (props.fields.choices || []).map((choice) => {
        if (choice.uuid === uuid) {
          return {
            ...choice,
            labels: {_default: newLabel},
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
          uuid: generateUuid(),
          labels: {_default: ''},
        },
      ],
    });
  }

  function deleteChoice(uuid: string) {
    props.onFieldsChange({
      choices: (props.fields.choices || []).filter(
        (choice) => choice.uuid !== uuid
      ),
    });
  }

  return (
    <>
      {props.fields.choices?.map((choice) => (
        <div className={styles.choice} key={choice.uuid}>
          <TextBox
            type='text-multiline'
            value={choice.labels._default}
            onChange={(newLabel: string) =>
              updateChoiceLabel(choice.uuid, newLabel)
            }
            placeholder={t('Type option name')}
            customClassNames={[styles.labelInput]}
            size='m'
            renderFocused
          />

          <Button
            type='bare'
            color='storm'
            size='m'
            startIcon='trash'
            onClick={() => deleteChoice(choice.uuid)}
            isDisabled={analysisQuestions.state.isPending}
          />
        </div>
      ))}

      <div className={styles.addOption}>
        <Button
          type='full'
          color='light-blue'
          size='m'
          startIcon='plus'
          label={t('Add new option')}
          onClick={addChoice}
          isDisabled={analysisQuestions.state.isPending}
        />
      </div>
    </>
  );
}
