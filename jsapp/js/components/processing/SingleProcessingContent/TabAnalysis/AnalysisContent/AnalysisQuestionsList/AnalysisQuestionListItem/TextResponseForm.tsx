import { Textarea } from '@mantine/core'
import React, { useState } from 'react'
import type { _DataSupplementResponseOneOfManualQualVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualQualVersionsItem'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'

interface Props {
  qaAnswer?: _DataSupplementResponseOneOfManualQualVersionsItem
  disabled: boolean
  onSave: (value: string) => Promise<unknown>
}

export default function TextResponseForm({ qaAnswer, onSave, disabled }: Props) {
  const [value, setValue] = useState<string>((qaAnswer?._data.value as string) ?? '') // TODO OpenAPI: DEV-1632
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>()

  const handleSave = async () => {
    clearTimeout(typingTimer)
    await onSave(value)
  }

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.currentTarget.value)
    clearTimeout(typingTimer)
    setTypingTimer(setTimeout(handleSave, AUTO_SAVE_TYPING_DELAY)) // After some seconds we auto save
  }

  return (
    <Textarea
      autosize
      minRows={2}
      value={value}
      onChange={handleChange}
      placeholder={t('Type your answer')}
      onBlur={handleSave}
      disabled={disabled}
    />
  )
}
