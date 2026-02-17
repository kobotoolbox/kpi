import { NumberInput } from '@mantine/core'
import React, { useState } from 'react'
import type { _DataSupplementResponseOneOfManualQualVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualQualVersionsItem'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'

interface Props {
  qaAnswer?: _DataSupplementResponseOneOfManualQualVersionsItem
  disabled: boolean
  onSave: (value: number | null) => Promise<unknown>
}

export default function IntegerResponseForm({ qaAnswer, onSave, disabled }: Props) {
  const [value, setValue] = useState<number | undefined>((qaAnswer?._data.value as number) ?? undefined)
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>()

  const handleSave = async () => {
    clearTimeout(typingTimer)
    await onSave(value ?? null)
  }

  const handleChange = (value: string | number) => {
    setValue(value as number)
    clearTimeout(typingTimer)
    setTypingTimer(setTimeout(handleSave, AUTO_SAVE_TYPING_DELAY)) // After some seconds we auto save
  }

  return (
    <NumberInput
      value={value}
      onChange={handleChange}
      placeholder={t('Type your response or use AI')}
      onBlur={handleSave}
      disabled={disabled}
    />
  )
}
