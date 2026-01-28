import React from 'react'
import type { ResponseQualSelectQuestionParams } from '#/api/models/responseQualSelectQuestionParams'
import RadioGroup from './RadioGroup'

interface Props {
  qaQuestion: ResponseQualSelectQuestionParams
  disabled: boolean
  onSave: (value: string) => Promise<unknown>
  value: string
}

export default function SelectOneResponseForm({ qaQuestion, onSave, disabled, value }: Props) {
  const handleChange = (newValue: string) => {
    onSave(newValue)
  }

  const options = qaQuestion.choices
    .filter((item) => !item.options?.deleted)
    .map((choice) => ({
      uuid: choice.uuid,
      label: choice.labels._default,
    }))

  return <RadioGroup options={options} value={value} onChange={handleChange} disabled={disabled} />
}
