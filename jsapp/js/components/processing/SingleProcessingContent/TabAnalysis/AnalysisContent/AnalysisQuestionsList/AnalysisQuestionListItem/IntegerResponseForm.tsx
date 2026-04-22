import { NumberInput } from '@mantine/core'
import React, { useEffect, useRef, useState } from 'react'
import type { _DataSupplementResponseOneOfManualQualVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualQualVersionsItem'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'

interface Props {
  qaAnswer?: _DataSupplementResponseOneOfManualQualVersionsItem
  disabled: boolean
  onSave: (value: number | null) => Promise<unknown>
}

export default function IntegerResponseForm({ qaAnswer, onSave, disabled }: Props) {
  const [value, setValue] = useState<number | undefined>((qaAnswer?._data.value as number) ?? undefined)
  const typingTimerRef = useRef<NodeJS.Timeout | undefined>()

  const clearTypingTimer = () => {
    if (!typingTimerRef.current) return
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = undefined
  }

  useEffect(() => () => clearTypingTimer(), [])

  const handleSave = async (valueToSave: number | undefined) => {
    clearTypingTimer()
    await onSave(valueToSave ?? null)
  }

  const handleChange = (inputValue: string | number) => {
    const nextValue = inputValue === '' ? undefined : (inputValue as number)
    setValue(nextValue)
    clearTypingTimer()
    typingTimerRef.current = setTimeout(() => {
      void handleSave(nextValue)
    }, AUTO_SAVE_TYPING_DELAY) // After some seconds we auto save
  }

  return (
    <NumberInput
      value={value}
      onChange={handleChange}
      placeholder={t('Type your answer')}
      onBlur={() => {
        void handleSave(value)
      }}
      disabled={disabled}
    />
  )
}
