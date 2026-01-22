import React, { useState } from 'react'
import MultiCheckbox, { type MultiCheckboxItem } from '#/components/common/multiCheckbox'

import { Radio } from '@mantine/core'
import type { _DataSupplementResponseOneOfManualQualVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualQualVersionsItem'
import type { QualSelectQuestionParams } from '#/api/models/qualSelectQuestionParams'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'

interface Props {
  qaQuestion: QualSelectQuestionParams
  qaAnswer?: _DataSupplementResponseOneOfManualQualVersionsItem
  disabled: boolean
  onSave: (values: string[]) => Promise<unknown>
}

export default function SelectMultipleResponseForm({ qaQuestion, qaAnswer, onSave, disabled }: Props) {
  const [values, setValues] = useState<string[]>((qaAnswer?._data.value as string[]) ?? []) // TODO OpenAPI: DEV-1632
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>()

  const handleSave = async () => {
    clearTimeout(typingTimer)
    await onSave(values)
  }

  const handleChange = (items: MultiCheckboxItem[]) => {
    setValues(items.filter((item) => item.checked).map((item) => item.name) as string[])
    clearTimeout(typingTimer)
    setTypingTimer(setTimeout(handleSave, AUTO_SAVE_TYPING_DELAY)) // After some seconds we auto save
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
            checked: values.includes(choice.uuid),
          }))}
        onChange={handleChange}
        disabled={!disabled}
      />
    </Radio.Group>
  )
}
