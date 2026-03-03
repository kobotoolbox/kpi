import React from 'react'
import MultiCheckbox, { type MultiCheckboxItem } from '#/components/common/multiCheckbox'

import { Radio } from '@mantine/core'
import type { ResponseQualSelectQuestionParams } from '#/api/models/responseQualSelectQuestionParams'
import type { QualVersionItem } from '#/components/processing/common/types'

interface Props {
  qaQuestion: ResponseQualSelectQuestionParams
  qaAnswer?: QualVersionItem
  disabled: boolean
  onSave: (values: string[]) => Promise<unknown>
}

export default function SelectMultipleResponseForm({ qaQuestion, qaAnswer, onSave, disabled }: Props) {
  const handleChange = (items: MultiCheckboxItem[]) => {
    // Use new variable/reference to ensure state is updated before saving
    const newValues = items.filter((item) => item.checked).map((item) => item.name) as string[]
    onSave(newValues)
  }

  return (
    <Radio.Group>
      <MultiCheckbox
        type='bare'
        items={qaQuestion.choices
          .filter((item) => !item.options?.deleted) // We hide all choices flagged as deleted…
          .map((choice) => ({
            name: choice.uuid,
            label: choice.labels._default,
            checked: (((qaAnswer?._data as any)?.value as string[]) ?? []).includes(choice.uuid),
          }))}
        onChange={handleChange}
        disabled={disabled}
      />
    </Radio.Group>
  )
}
