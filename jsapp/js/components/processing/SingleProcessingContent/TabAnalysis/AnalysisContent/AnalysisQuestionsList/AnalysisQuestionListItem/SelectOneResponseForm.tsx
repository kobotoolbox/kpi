import React from 'react'

import { Paper } from '@mantine/core'
import cx from 'classnames'
import type { ResponseQualSelectQuestionParams } from '#/api/models/responseQualSelectQuestionParams'
import styles from '../../../common/styles.module.scss'
import RadioGroup from './RadioGroup'

interface Props {
  qaQuestion: ResponseQualSelectQuestionParams
  disabled: boolean
  onSave: (value: string) => Promise<unknown>
  value: string
  isAnswerAIGenerated: boolean
}

export default function SelectOneResponseForm({ qaQuestion, onSave, disabled, value, isAnswerAIGenerated }: Props) {
  const handleChange = (newValue: string) => {
    onSave(newValue)
  }

  const options = qaQuestion.choices
    .filter((item) => !item.options?.deleted)
    .map((choice) => ({
      uuid: choice.uuid,
      label: choice.labels._default,
    }))

  return (
    <Paper
      p='md'
      radius='md'
      shadow='none'
      className={cx({
        [styles.responseBorderAI]: isAnswerAIGenerated,
        [styles.responseBorderDefault]: !isAnswerAIGenerated,
      })}
    >
      <RadioGroup options={options} value={value} onChange={handleChange} disabled={disabled} />
    </Paper>
  )
}
