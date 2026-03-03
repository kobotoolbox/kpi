import React from 'react'

import { Radio, TagsInput } from '@mantine/core'
import type { QualVersionItem } from '#/components/processing/common/types'

interface Props {
  qaAnswer?: QualVersionItem
  disabled: boolean
  onSave: (values: string[]) => Promise<unknown>
}

export default function SelectMultipleResponseForm({ qaAnswer, onSave, disabled }: Props) {
  return (
    <Radio.Group>
      <TagsInput
        value={(qaAnswer?._data as any)?.value ?? []}
        onChange={onSave}
        acceptValueOnBlur
        disabled={disabled}
      />
    </Radio.Group>
  )
}
