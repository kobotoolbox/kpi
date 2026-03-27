import { Textarea } from '@mantine/core'
import React, { useEffect, useState } from 'react'
import type { QualVersionItem } from '#/components/processing/common/types'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'
import styles from '../../../common/styles.module.scss'

interface Props {
  qaAnswer?: QualVersionItem
  disabled: boolean
  onSave: (value: string) => Promise<unknown>
  isAnswerAIGenerated: boolean
}

export default function TextResponseForm({ qaAnswer, onSave, disabled, isAnswerAIGenerated }: Props) {
  const [value, setValue] = useState<string>(((qaAnswer?._data as any)?.value as string) ?? '')
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>()
  const autoQAEnabled = useFeatureFlag(FeatureFlag.autoQAEnabled)
  // Sync local state when a new version is set (e.g. after AI generation)
  useEffect(() => {
    const newValue = ((qaAnswer?._data as any)?.value as string) ?? ''
    if (isAnswerAIGenerated || newValue === '') {
      clearTimeout(typingTimer)
      setValue(newValue)
    }
  }, [qaAnswer?._uuid, isAnswerAIGenerated])
  const handleBlur = async () => {
    clearTimeout(typingTimer)
    await onSave(value)
  }
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.currentTarget.value
    setValue(newValue)
    clearTimeout(typingTimer)
    setTypingTimer(setTimeout(() => onSave(newValue), AUTO_SAVE_TYPING_DELAY)) // After some seconds we auto save
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
      placeholder={autoQAEnabled ? t('Type your response or use AI') : t('Type your response')}
      onBlur={handleBlur}
      disabled={disabled}
    />
  )
}
