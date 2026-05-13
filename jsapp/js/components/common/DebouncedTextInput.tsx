import { useDebouncedCallback } from '@mantine/hooks'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import TextInput from './TextInput'
import type { TextInputProps } from './TextInput'

export interface DebouncedTextInputProps extends Omit<TextInputProps, 'value' | 'onChange'> {
  value?: string
  onChange: (value: string) => void
  debounceTimeout?: number
  forceNotifyByEnter?: boolean
  forceNotifyOnBlur?: boolean
  onFocus?: React.FocusEventHandler<HTMLInputElement>
}

const DEFAULT_DEBOUNCE_TIMEOUT = 300

/**
 * A TextInput wrapper that adds debounced timeout for typing.
 */
export default function DebouncedTextInput(props: DebouncedTextInputProps) {
  const {
    value,
    onChange,
    onBlur,
    onFocus,
    onKeyDown,
    debounceTimeout = DEFAULT_DEBOUNCE_TIMEOUT,
    forceNotifyByEnter = true,
    forceNotifyOnBlur = true,
    ...restProps
  } = props

  const [inputValue, setInputValue] = useState(value ?? '')
  // While the input is focused the user is in control of its content. Syncing from the prop during that window would
  // clobber characters typed since the last debounce commit. When the input is blurred we're safe to accept any
  // external change the parent sends (e.g. a "clear filters" reset).
  const isFocusedRef = useRef(false)

  useEffect(() => {
    if (!isFocusedRef.current) {
      setInputValue(value ?? '')
    }
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
      isFocusedRef.current = false
      if (forceNotifyOnBlur) {
        debouncedOnChange.flush()
      }

      onBlur?.(event)
    },
    [forceNotifyOnBlur, debouncedOnChange, onBlur],
  )

  const onInputFocus = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = true
      onFocus?.(event)
    },
    [onFocus],
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
      onFocus={onInputFocus}
      onKeyDown={onInputKeyDown}
    />
  )
}
