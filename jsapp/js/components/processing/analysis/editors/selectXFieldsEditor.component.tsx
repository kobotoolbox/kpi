import React, {useContext} from 'react';
import styles from './selectXFieldsEditor.module.scss';
import type {AdditionalFields} from 'js/components/processing/analysis/constants';
import Button from 'js/components/common/button';
import {generateUuid} from 'js/utils';
import TextBox from 'jsapp/js/components/common/textBox';
import AnalysisQuestionsContext from 'js/components/processing/analysis/analysisQuestions.context';
import {findQuestion} from 'js/components/processing/analysis/utils';

interface SelectXFieldsEditorProps {
  questionUuid: string;
  fields: AdditionalFields;
  onFieldsChange: (fields: AdditionalFields) => void;
}

/**
 * Displays a form for creating choices for "select x" question types. We only
 * expose editing the choice label to users - the choice uuid is pregenerated.
 */
export default function SelectXFieldsEditor(props: SelectXFieldsEditorProps) {
  const analysisQuestions = useContext(AnalysisQuestionsContext);
  if (!analysisQuestions) {
    return null;
  }

  // Get the question data from state (with safety check)
  const question = findQuestion(props.questionUuid, analysisQuestions.state);
  if (!question) {
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
    // When we are going to delete a choice, we need to check if it already
    // existed in the stored data, or if it was simply created but not saved yet.

    const foundChoice = question?.additionalFields?.choices?.find(
      (item) => item.uuid === uuid
    );

    if (foundChoice) {
      // flag it
      props.onFieldsChange({
        choices: (props.fields.choices || []).map((choice) => {
          if (choice.uuid === uuid) {
            if (typeof choice.options !== 'object') {
              choice.options = {};
            }
            choice.options.deleted = true;
          }
          return choice;
        }),
      });
    } else {
      // remove it
      props.onFieldsChange({
        choices: (props.fields.choices || []).filter(
          (choice) => choice.uuid !== uuid
        ),
      });
    }
  }

  // We hide questions marked as deleted
  const choicesToDisplay =
    props.fields.choices?.filter((item) => {
      if (item.options?.deleted) {
        return false;
      }
      return true;
    }) || [];

  return (
    <>
      {choicesToDisplay.map((choice) => (
        <div className={styles.choice} key={choice.uuid}>
          <TextBox
            value={choice.labels._default}
            onChange={(newLabel: string) =>
              updateChoiceLabel(choice.uuid, newLabel)
            }
            placeholder={t('Type option name')}
            className={styles.labelInput}
            size='m'
            renderFocused
          />

          <Button
            type='secondary-danger'
            size='m'
            startIcon='trash'
            onClick={() => deleteChoice(choice.uuid)}
            isDisabled={analysisQuestions.state.isPending}
          />
        </div>
      ))}

      <div className={styles.addOption}>
        <Button
          type='secondary'
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
