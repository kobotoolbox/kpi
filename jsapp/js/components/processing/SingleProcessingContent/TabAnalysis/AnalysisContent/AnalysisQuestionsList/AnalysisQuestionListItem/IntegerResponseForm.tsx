import { NumberInput } from '@mantine/core'
import React, { useEffect, useState } from 'react'
import type { QualVersionItem } from '#/components/processing/common/types'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'

interface Props {
  qaAnswer?: QualVersionItem
  disabled: boolean
  onSave: (value: number | null) => Promise<unknown>
}

export default function IntegerResponseForm({ qaAnswer, onSave, disabled }: Props) {
  const [value, setValue] = useState<number | undefined>(((qaAnswer?._data as any)?.value as number) ?? undefined)
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>()

  // Sync local state when a new version is set (e.g. after AI generation)
  useEffect(() => {
    setValue(((qaAnswer?._data as any)?.value as number) ?? undefined)
  }, [qaAnswer?._uuid])

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
