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
    onKeyDown,
    debounceTimeout = DEFAULT_DEBOUNCE_TIMEOUT,
    forceNotifyByEnter = true,
    forceNotifyOnBlur = true,
    ...restProps
  } = props

  const [inputValue, setInputValue] = useState(value ?? '')
  // Tracks the last value we passed to onChange so we can distinguish
  // "parent echoing our own commit back" from a genuine external update.
  const lastCommittedValueRef = useRef(value ?? '')

  useEffect(() => {
    const normalized = value ?? ''
    // Only sync from the prop when the parent is driving a real change — not
    // when it's just mirroring back a value we already committed. Without this
    // guard, a re-render that arrives while the user is still typing resets
    // inputValue and silently drops the characters typed since the last commit.
    if (normalized !== lastCommittedValueRef.current) {
      setInputValue(normalized)
      lastCommittedValueRef.current = normalized
    }
  }, [value])

  const debouncedOnChange = useDebouncedCallback(
    (nextValue: string) => {
      lastCommittedValueRef.current = nextValue
      onChange(nextValue)
    },
    {
      delay: debounceTimeout,
      // Flush any pending call when the component unmounts so the parent always receives the last typed value (e.g. when
      // the input is removed while the debounce timer is still running).
      flushOnUnmount: true,
    },
  )

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
