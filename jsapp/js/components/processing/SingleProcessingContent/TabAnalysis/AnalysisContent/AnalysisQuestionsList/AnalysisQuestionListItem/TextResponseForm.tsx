import { Textarea } from '@mantine/core'
import React, { useEffect, useRef, useState } from 'react'
import type { QualVersionItem } from '#/components/processing/common/types'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'
import styles from '../../../common/styles.module.scss'

interface Props {
  qaAnswer?: QualVersionItem
  disabled: boolean
  onSave: (value: string) => Promise<unknown>
  isAnswerAIGenerated: boolean
}

export default function TextResponseForm({ qaAnswer, onSave, disabled, isAnswerAIGenerated }: Props) {
  const initialValue = ((qaAnswer?._data as any)?.value as string) ?? ''
  const [value, setValue] = useState<string>(initialValue)
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>()
  // Mirrors value state so the effect below can read it without being a dependency
  const valueRef = useRef<string>(initialValue)
  // Tracks what was last sent via onSave, to detect unsaved local edits
  const lastSentValue = useRef<string>(initialValue)

  // Sync local state when a new version is set (e.g. after AI generation),
  // but skip if the user has typed something since the last save
  useEffect(() => {
    const serverValue = ((qaAnswer?._data as any)?.value as string) ?? ''
    if (valueRef.current === lastSentValue.current) {
      setValue(serverValue)
      valueRef.current = serverValue
      lastSentValue.current = serverValue
    }
  }, [qaAnswer?._uuid])

  const handleSave = async () => {
    clearTimeout(typingTimer)
    lastSentValue.current = value
    await onSave(value)
  }

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.currentTarget.value
    setValue(newValue)
    valueRef.current = newValue
    clearTimeout(typingTimer)
    setTypingTimer(
      setTimeout(async () => {
        lastSentValue.current = newValue
        await onSave(newValue)
      }, AUTO_SAVE_TYPING_DELAY), // After some seconds we auto save
    )
  }

  return (
    <Textarea
      classNames={{
        input: isAnswerAIGenerated ? styles.responseBorderAI : styles.responseBorderDefault,
      }}
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
