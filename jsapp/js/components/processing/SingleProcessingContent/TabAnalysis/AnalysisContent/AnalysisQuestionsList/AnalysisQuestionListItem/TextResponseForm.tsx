import { Textarea } from '@mantine/core'
import React, { useEffect, useState } from 'react'
import type { QualVersionItem } from '#/components/processing/common/types'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'

interface Props {
  qaAnswer?: QualVersionItem
  disabled: boolean
  onSave: (value: string) => Promise<unknown>
}

export default function TextResponseForm({ qaAnswer, onSave, disabled }: Props) {
  const [value, setValue] = useState<string>(((qaAnswer?._data as any)?.value as string) ?? '')
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>()

  // Sync local state when a new version is set (e.g. after AI generation)
  useEffect(() => {
    setValue(((qaAnswer?._data as any)?.value as string) ?? '')
  }, [qaAnswer?._uuid])

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
      placeholder={t('Type your response or use AI')}
      onBlur={handleSave}
      disabled={disabled}
    />
  )
}
