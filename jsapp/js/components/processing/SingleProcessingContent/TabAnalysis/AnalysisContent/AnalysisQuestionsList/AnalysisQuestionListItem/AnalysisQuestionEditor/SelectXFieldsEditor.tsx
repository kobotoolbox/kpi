import React from 'react'
import type { ResponseQualSelectQuestionParams } from '#/api/models/responseQualSelectQuestionParams'
import type { ResponseQualSelectQuestionParamsChoicesItem } from '#/api/models/responseQualSelectQuestionParamsChoicesItem'
import Button from '#/components/common/button'
import TextBox from '#/components/common/textBox'
import { generateUuid } from '#/utils'
import styles from './SelectXFieldsEditor.module.scss'

interface Props {
  qaQuestion: ResponseQualSelectQuestionParams
  onChange: (choices: ResponseQualSelectQuestionParamsChoicesItem[]) => void
  disabled: boolean
}

/**
 * Displays a form for creating choices for "select x" question types. We only
 * expose editing the choice label to users - the choice uuid is pregenerated.
 */
export default function SelectXFieldsEditor({ qaQuestion, onChange, disabled }: Props) {
  function handleEditLabel(uuid: string, newLabel: string) {
    onChange(
      qaQuestion.choices.map((choice) => ({
        ...choice,
        ...(choice.uuid === uuid ? { labels: { _default: newLabel } } : {}),
      })),
    )
  }

  function handleAdd() {
    onChange([...qaQuestion.choices, { uuid: generateUuid(), labels: { _default: '' } }])
  }

  /**
   * FYI: backend handles "missing" choices by marking them with `choice.options.deleted: true` instead of deleting.
   * FYI: if this deletes a not-yet-saved choice, no harm done and backend never knew about it.
   */
  function handleDelete(uuid: string) {
    onChange(qaQuestion.choices.filter((choice) => choice.uuid !== uuid))
  }

  return (
    <>
      {qaQuestion.choices
        .filter((choice) => !choice.options?.deleted) // Filter "deleted" choices.
        .map((choice) => (
          <div className={styles.choice} key={choice.uuid}>
            <TextBox
              value={choice.labels._default}
              onChange={(newLabel: string) => handleEditLabel(choice.uuid, newLabel)}
              placeholder={t('Type option name')}
              className={styles.labelInput}
              size='m'
              renderFocused
            />

            <Button
              type='secondary-danger'
              size='m'
              startIcon='trash'
              onClick={() => handleDelete(choice.uuid)}
              isDisabled={disabled}
            />
          </div>
        ))}

      <div className={styles.addOption}>
        <Button
          type='secondary'
          size='m'
          startIcon='plus'
          label={t('Add new option')}
          onClick={handleAdd}
          isDisabled={disabled}
        />
      </div>
    </>
  )
}
