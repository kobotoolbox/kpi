import React, { useEffect, useState } from 'react'

import Textarea from '#/components/common/Textarea'

interface TranslationsEditorCellProps {
  initialValue: string
  disabled: boolean
  absoluteIndex: number
  onChangeCell: (absoluteIndex: number, value: string) => void
}

export default function TranslationsEditorCell({
  initialValue,
  disabled,
  absoluteIndex,
  onChangeCell,
}: TranslationsEditorCellProps) {
  // The row value reaches us through react-query, which delivers updates a tick late. Holding
  // the draft locally keeps the textarea from snapping back (and moving the caret) meanwhile.
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  return (
    <Textarea
      autosize
      value={value}
      disabled={disabled}
      dir='auto'
      styles={{ input: { width: '100%' } }}
      onChange={(evt) => {
        setValue(evt.target.value)
        onChangeCell(absoluteIndex, evt.target.value)
      }}
    />
  )
}
