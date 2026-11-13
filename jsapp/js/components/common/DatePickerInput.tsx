import type { DatePickerInputProps } from '@mantine/dates'
import React, { Suspense } from 'react'
import TextInput from './TextInput'

// No prefetch: only a few screens need a date picker.
const DatePickerInputMantine = React.lazy(() => import('./DatePickerInputMantine'))

export type { DatePickerInputProps }

/**
 * Single date picker. Loads `@mantine/dates` on first render and shows a
 * read-only input of the same size until then.
 */
export default function DatePickerInput(props: DatePickerInputProps) {
  return (
    <Suspense fallback={<TextInput readOnly size={props.size} label={props.label} placeholder={props.placeholder} />}>
      <DatePickerInputMantine {...props} />
    </Suspense>
  )
}
