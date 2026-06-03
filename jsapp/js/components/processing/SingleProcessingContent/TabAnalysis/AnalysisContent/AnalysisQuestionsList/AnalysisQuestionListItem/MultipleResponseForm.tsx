import { Radio } from '@mantine/core'
import cx from 'classnames'
import React from 'react'
import type { ResponseQualSelectQuestionParams } from '#/api/models/responseQualSelectQuestionParams'
import MultiCheckbox, { type MultiCheckboxItem } from '#/components/common/multiCheckbox'
import type { QualVersionItem } from '#/components/processing/common/types'
import styles from '../../../common/styles.module.scss'
import { useShowHints } from '../../../common/utils'

interface Props {
  qaQuestion: ResponseQualSelectQuestionParams
  qaAnswer?: QualVersionItem
  disabled: boolean
  onSave: (values: string[]) => Promise<unknown>
  isAnswerAIGenerated: boolean
}

export default function SelectMultipleResponseForm({
  qaQuestion,
  qaAnswer,
  onSave,
  disabled,
  isAnswerAIGenerated,
}: Props) {
  const [showHints] = useShowHints()

  const handleChange = (items: MultiCheckboxItem[]) => {
    // Use new variable/reference to ensure state is updated before saving
    const newValues = items.filter((item) => item.checked).map((item) => item.name) as string[]
    onSave(newValues)
  }

  return (
    <Radio.Group
      p='md'
      style={{ borderRadius: 'var(--mantine-radius-md)' }}
      className={cx({
        [styles.responseBorderAI]: isAnswerAIGenerated,
        [styles.responseBorderDefault]: !isAnswerAIGenerated,
      })}
    >
      <MultiCheckbox
        type='bare'
        items={qaQuestion.choices
          .filter((item) => !item.options?.deleted) // We hide all choices flagged as deleted…
          .map((choice) => ({
            name: choice.uuid,
            label: choice.labels._default,
            hint: showHints ? (choice.hint?.labels as { [key: string]: string | undefined })?._default : undefined,
            checked: (((qaAnswer?._data as any)?.value as string[]) ?? []).includes(choice.uuid),
          }))}
        onChange={handleChange}
        disabled={disabled}
      />
    </Radio.Group>
  )
}
