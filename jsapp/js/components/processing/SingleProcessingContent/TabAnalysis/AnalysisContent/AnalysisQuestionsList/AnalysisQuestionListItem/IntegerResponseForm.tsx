import { NumberInput } from '@mantine/core'
import React, { useEffect, useState } from 'react'
import type { QualVersionItem } from '#/components/processing/common/types'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'
import styles from '../../../common/styles.module.scss'

interface Props {
  qaAnswer?: QualVersionItem
  disabled: boolean
  onSave: (value: number | null) => Promise<unknown>
  isAnswerAIGenerated: boolean
}

export default function IntegerResponseForm({ qaAnswer, onSave, disabled, isAnswerAIGenerated }: Props) {
  // `value` can be a (empty) string when you remove it
  const [value, setValue] = useState<number | string | undefined>(((qaAnswer?._data as any)?.value as number) ?? '')
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>()

  // Sync local state when a new version is set (e.g. after AI generation)
  useEffect(() => {
    const newValue = ((qaAnswer?._data as any)?.value as number | undefined) ?? ''
    if (isAnswerAIGenerated || newValue === '') {
      clearTimeout(typingTimer)
      setValue(newValue)
    }
  }, [qaAnswer?._uuid, isAnswerAIGenerated])

  const handleSave = async () => {
    clearTimeout(typingTimer)
    await onSave(typeof value === 'number' ? value : null)
  }

  const handleChange = (newValue: string | number) => {
    setValue(newValue)
    clearTimeout(typingTimer)
    setTypingTimer(setTimeout(() => onSave(typeof newValue === 'number' ? newValue : null), AUTO_SAVE_TYPING_DELAY))
  }

  return (
    <NumberInput
      classNames={{
        input: isAnswerAIGenerated ? styles.responseBorderAI : styles.responseBorderDefault,
      }}
      value={value}
      onChange={handleChange}
      placeholder={t('Type your response or use AI')}
      onBlur={handleSave}
      disabled={disabled}
    />
  )
}
