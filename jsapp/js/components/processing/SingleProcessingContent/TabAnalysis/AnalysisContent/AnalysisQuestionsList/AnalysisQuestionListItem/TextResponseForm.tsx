import { Textarea } from '@mantine/core'
import React, { useEffect, useState } from 'react'
import type { _DataSupplementResponseOneOfManualQualVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualQualVersionsItem'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'

interface Props {
  qaAnswer?: _DataSupplementResponseOneOfManualQualVersionsItem
  submissionUid: string
  disabled: boolean
  onSave: (value: string) => Promise<unknown>
}

export default function TextResponseForm({ qaAnswer, submissionUid, onSave, disabled }: Props) {
  const [value, setValue] = useState<string>((qaAnswer?._data.value as string) ?? '')
  const [isDirty, setIsDirty] = useState(false)
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>()

  // New submissions should always display their own saved value.
  useEffect(() => {
    clearTimeout(typingTimer)
    setValue((qaAnswer?._data.value as string) ?? '')
    setIsDirty(false)
  }, [submissionUid])

  // Within a single submission, avoid clobbering local typing with server updates.
  useEffect(() => {
    if (isDirty) return
    setValue((qaAnswer?._data.value as string) ?? '')
  }, [qaAnswer?._uuid, isDirty])

  const handleSave = async () => {
    clearTimeout(typingTimer)
    await onSave(value)
  }

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIsDirty(true)
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
