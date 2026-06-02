import React from 'react'

import { Radio } from '@mantine/core'
import TagsInput from '#/components/common/TagsInput'
import type { QualVersionItem } from '#/components/processing/common/types'
import styles from '../../../common/styles.module.scss'

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
        classNames={{
          input: styles.responseBorderDefault,
        }}
      />
    </Radio.Group>
  )
}
