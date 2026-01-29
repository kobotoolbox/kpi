import React, { useState } from 'react'

import { Radio, TagsInput } from '@mantine/core'
import type { _DataSupplementResponseOneOfManualQualVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualQualVersionsItem'
import { AUTO_SAVE_TYPING_DELAY } from '../../../common/constants'

interface Props {
  qaAnswer?: _DataSupplementResponseOneOfManualQualVersionsItem
  disabled: boolean
  onSave: (values: string[]) => Promise<unknown>
}

export default function SelectMultipleResponseForm({ qaAnswer, onSave, disabled }: Props) {
  const [values, setValues] = useState<string[]>((qaAnswer?._data.value as string[]) ?? [])
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout>()

  const handleSave = async () => {
    clearTimeout(typingTimer)
    await onSave(values)
  }

  const handleChange = (items: string[]) => {
    setValues(items)
    clearTimeout(typingTimer)
    setTypingTimer(setTimeout(handleSave, AUTO_SAVE_TYPING_DELAY)) // After some seconds we auto save
  }

  return (
    <Radio.Group>
      <TagsInput value={values} onChange={handleChange} acceptValueOnBlur disabled={disabled} />
    </Radio.Group>
  )
}
