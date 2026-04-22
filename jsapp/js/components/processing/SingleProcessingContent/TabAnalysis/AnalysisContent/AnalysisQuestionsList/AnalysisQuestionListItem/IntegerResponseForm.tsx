import { NumberInput } from '@mantine/core'
import React, { useEffect, useState } from 'react'
import type { _DataSupplementResponseOneOfManualQualVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualQualVersionsItem'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'

interface Props {
  qaAnswer?: _DataSupplementResponseOneOfManualQualVersionsItem
  submissionUid: string
  disabled: boolean
  onSave: (value: number | null) => Promise<unknown>
}

export default function IntegerResponseForm({ qaAnswer, submissionUid, onSave, disabled }: Props) {
  const [value, setValue] = useState<number | undefined>((qaAnswer?._data.value as number) ?? undefined)
  const [isDirty, setIsDirty] = useState(false)
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>()

  // New submissions should always display their own saved value.
  useEffect(() => {
    clearTimeout(typingTimer)
    setValue((qaAnswer?._data.value as number) ?? undefined)
    setIsDirty(false)
  }, [submissionUid])

  // Within a single submission, avoid clobbering local typing with server updates.
  useEffect(() => {
    if (isDirty) return
    setValue((qaAnswer?._data.value as number) ?? undefined)
  }, [qaAnswer?._uuid, isDirty])

  const handleSave = async () => {
    clearTimeout(typingTimer)
    await onSave(value ?? null)
  }

  const handleChange = (inputValue: string | number) => {
    setIsDirty(true)
    setValue(inputValue === '' ? undefined : (inputValue as number))
    clearTimeout(typingTimer)
    setTypingTimer(setTimeout(handleSave, AUTO_SAVE_TYPING_DELAY)) // After some seconds we auto save
  }

  return (
    <NumberInput
      value={value}
      onChange={handleChange}
      placeholder={t('Type your answer')}
      onBlur={handleSave}
      disabled={disabled}
    />
  )
}
