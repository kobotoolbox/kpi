import { extractStyleProps } from '@mantine/core'
import type { DatePickerInputProps } from '@mantine/dates'
import React, { Suspense } from 'react'
import { formatDate } from '#/utils'
import TextInput from './TextInput'

// No prefetch: only a few screens need a date picker.
const DatePickerInputMantine = React.lazy(() => import('./DatePickerInputMantine'))

export type { DatePickerInputProps }

/** Looks like the picker, so nothing flickers when it replaces this. Exported for the comparison story. */
export function DatePickerInputFallback(props: DatePickerInputProps) {
  const { styleProps } = extractStyleProps(props)
  const value = props.value ?? props.defaultValue

  return (
    <TextInput
      readOnly
      // Keeps the white background and pointer cursor of the picker's button. Our theme greys out read-only inputs.
      pointer
      // The picker's placeholder is darker, see `DatePickerInput.module.css`.
      styles={{ input: { '--input-placeholder-color': 'var(--mantine-color-gray-2)' } }}
      value={typeof value === 'string' ? formatDate(value, false) : ''}
      placeholder={props.placeholder}
      label={props.label}
      description={props.description}
      error={props.error}
      required={props.required}
      withAsterisk={props.withAsterisk}
      disabled={props.disabled}
      size={props.size}
      radius={props.radius}
      leftSection={props.leftSection}
      className={props.className}
      style={props.style}
      {...styleProps}
    />
  )
}

/**
 * Single date picker. Loads `@mantine/dates` on first render and shows a
 * read-only input that looks the same until then.
 */
export default function DatePickerInput(props: DatePickerInputProps) {
  return (
    <Suspense fallback={<DatePickerInputFallback {...props} />}>
      <DatePickerInputMantine {...props} />
    </Suspense>
  )
}
