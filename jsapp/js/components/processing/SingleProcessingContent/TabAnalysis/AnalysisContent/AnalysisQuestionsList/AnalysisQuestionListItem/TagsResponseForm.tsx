import React from 'react'

import { Radio, TagsInput } from '@mantine/core'
import type { SupplementalDataVersionItemQual } from '#/api/models/supplementalDataVersionItemQual'

interface Props {
  qaAnswer?: SupplementalDataVersionItemQual
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
