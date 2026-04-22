import { Textarea } from '@mantine/core'
import React, { useEffect, useRef, useState } from 'react'
import type { _DataSupplementResponseOneOfManualQualVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualQualVersionsItem'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'

interface Props {
  qaAnswer?: _DataSupplementResponseOneOfManualQualVersionsItem
  disabled: boolean
  onSave: (value: string) => Promise<unknown>
}

export default function TextResponseForm({ qaAnswer, onSave, disabled }: Props) {
  const [value, setValue] = useState<string>((qaAnswer?._data.value as string) ?? '')
  const typingTimerRef = useRef<NodeJS.Timeout | undefined>()

  const clearTypingTimer = () => {
    if (!typingTimerRef.current) return
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = undefined
  }

  useEffect(() => () => clearTypingTimer(), [])

  const handleSave = async (valueToSave: string) => {
    clearTypingTimer()
    await onSave(valueToSave)
  }

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.currentTarget.value
    setValue(nextValue)
    clearTypingTimer()
    typingTimerRef.current = setTimeout(() => {
      handleSave(nextValue)
    }, AUTO_SAVE_TYPING_DELAY) // After some seconds we auto save
  }

  return (
    <Textarea
      autosize
      minRows={2}
      value={value}
      onChange={handleChange}
      placeholder={t('Type your answer')}
      onBlur={() => {
        handleSave(value)
      }}
      disabled={disabled}
    />
  )
}
