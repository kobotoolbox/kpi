import { useDebouncedCallback } from '@mantine/hooks'
import React, { useCallback, useEffect, useState } from 'react'
import TextInput from './textInput'
import type { TextInputProps } from './textInput'

export interface DebouncedTextInputProps extends Omit<TextInputProps, 'value' | 'onChange'> {
  value?: string
  onChange: (value: string) => void
  debounceTimeout?: number
  forceNotifyByEnter?: boolean
  forceNotifyOnBlur?: boolean
}

const DEFAULT_DEBOUNCE_TIMEOUT = 750

/**
 * A TextInput wrapper that adds debounced timeout for typing.
 */
export default function DebouncedTextInput(props: DebouncedTextInputProps) {
  const {
    value,
    onChange,
    onBlur,
    onKeyDown,
    debounceTimeout = DEFAULT_DEBOUNCE_TIMEOUT,
    forceNotifyByEnter = true,
    forceNotifyOnBlur = true,
    ...restProps
  } = props

  const [inputValue, setInputValue] = useState(value ?? '')

  useEffect(() => {
    setInputValue(value ?? '')
  }, [value])

  const debouncedOnChange = useDebouncedCallback(onChange, {
    delay: debounceTimeout,
    // Flush any pending call when the component unmounts so the parent always receives the last typed value (e.g. when
    // the input is removed while the debounce timer is still running).
    flushOnUnmount: true,
  })

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value
      setInputValue(nextValue)
      debouncedOnChange(nextValue)
    },
    [debouncedOnChange],
  )

  const onInputBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      if (forceNotifyOnBlur) {
        debouncedOnChange.flush()
      }

      onBlur?.(event)
    },
    [forceNotifyOnBlur, debouncedOnChange, onBlur],
  )

  const onInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (forceNotifyByEnter && event.key === 'Enter') {
        debouncedOnChange.flush()
      }

      onKeyDown?.(event)
    },
    [forceNotifyByEnter, debouncedOnChange, onKeyDown],
  )

  return (
    <TextInput
      {...restProps}
      value={inputValue}
      onChange={onInputChange}
      onBlur={onInputBlur}
      onKeyDown={onInputKeyDown}
    />
  )
}
