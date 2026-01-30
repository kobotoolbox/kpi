import React from 'react'

import { Radio, TagsInput } from '@mantine/core'
import type { _DataSupplementResponseOneOfManualQualVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualQualVersionsItem'

interface Props {
  qaAnswer?: _DataSupplementResponseOneOfManualQualVersionsItem
  disabled: boolean
  onSave: (values: string[]) => Promise<unknown>
}

export default function SelectMultipleResponseForm({ qaAnswer, onSave, disabled }: Props) {
  return (
    <Radio.Group>
      <TagsInput
        value={(qaAnswer?._data.value as string[]) ?? []}
        onChange={onSave}
        acceptValueOnBlur
        disabled={disabled}
      />
    </Radio.Group>
  )
}
