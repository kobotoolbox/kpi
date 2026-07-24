import React, { useEffect, useRef, useState } from 'react'

import Textarea from '#/components/common/Textarea'

interface TranslationsEditorCellProps {
  initialValue: string
  disabled: boolean
  absoluteIndex: number
  onStartEditing: () => void
  onChangeCell: (absoluteIndex: number, value: string) => void
}

export default function TranslationsEditorCell({
  initialValue,
  disabled,
  absoluteIndex,
  onStartEditing,
  onChangeCell,
}: TranslationsEditorCellProps) {
  // Keep the editable value local so typing does not re-render the whole table
  // and steal focus from the textarea.
  const [value, setValue] = useState(initialValue)
  const isDirtyRef = useRef(false)

  useEffect(() => {
    // When the table row itself changes, reset the local draft to match it.
    setValue(initialValue)
    isDirtyRef.current = false
  }, [initialValue, absoluteIndex])

  return (
    <Textarea
      autosize
      value={value}
      disabled={disabled}
      dir='auto'
      styles={{ input: { width: '100%' } }}
      onChange={(evt) => {
        setValue(evt.target.value)
        if (!isDirtyRef.current) {
          // Mark the table as dirty on the first edit, but avoid committing the
          // row update yet so the input keeps its focus.
          isDirtyRef.current = true
          onStartEditing()
        }
      }}
      onBlur={() => {
        if (isDirtyRef.current) {
          // Commit the edited value only after blur so the parent can update the
          // table row without interrupting the active typing session.
          onChangeCell(absoluteIndex, value)
          isDirtyRef.current = false
        }
      }}
    />
  )
}
