import { Radio, Stack } from '@mantine/core'
import React, { useState, type ChangeEvent } from 'react'
import type { _DataSupplementResponseOneOfManualQualVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualQualVersionsItem'
import type { QualSelectQuestionParams } from '#/api/models/qualSelectQuestionParams'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'

interface Props {
  qaQuestion: QualSelectQuestionParams
  qaAnswer?: _DataSupplementResponseOneOfManualQualVersionsItem
  disabled: boolean
  onSave: (value: string) => Promise<unknown>
}

export default function SelectOneResponseForm({ qaQuestion, qaAnswer, onSave, disabled }: Props) {
  const [value, setValue] = useState<string>((qaAnswer?._data.value as string) ?? '') // TODO OpenAPI: DEV-1632
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>()

  const handleSave = async () => {
    clearTimeout(typingTimer)
    await onSave(value)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.currentTarget.value)
    clearTimeout(typingTimer)
    setTypingTimer(setTimeout(handleSave, AUTO_SAVE_TYPING_DELAY)) // After some seconds we auto save
  }

  return (
    <Radio.Group>
      <Stack gap={'xs'} /* TODO: Radio.Group component */>
        {qaQuestion.choices
          .filter((item) => !item.options?.deleted) // We hide all choices flagged as deleted…
          .map((option) => (
            <Radio
              key={option.uuid}
              value={option.uuid}
              label={option.labels._default}
              onChange={handleChange}
              checked={value === option.uuid} // TODO: sometimes visually not checked, but values checks out :shrug:
              disabled={disabled}
            />
          ))}
      </Stack>
    </Radio.Group>
  )
}
