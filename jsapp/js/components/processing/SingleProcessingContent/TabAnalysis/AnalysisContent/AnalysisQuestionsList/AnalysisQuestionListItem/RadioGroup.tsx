import { Radio, Stack, Text } from '@mantine/core'
import React, { type ChangeEvent } from 'react'

export interface RadioGroupOption {
  uuid: string
  label: string
  hint?: string
  disabled?: boolean
}

interface RadioGroupProps {
  options: RadioGroupOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function RadioGroup({ options, value, onChange, disabled }: RadioGroupProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.value)
  }

  return (
    <Radio.Group value={value} onChange={onChange}>
      <Stack gap={'xs'}>
        {options.map((option) => (
          <Stack gap='0'>
            <Radio
              key={option.uuid}
              value={option.uuid}
              // When there's a hint displayed, the label needs to be more prominent
              label={option.hint ? <strong>{option.label}</strong> : option.label}
              onChange={handleChange}
              checked={value === option.uuid}
              disabled={disabled || option.disabled}
            />
            {option.hint && (
              <Text pl='26px' fz='xs' m='0' ta='left' c='var(--mantine-color-gray-2)'>
                {option.hint}
              </Text>
            )}
          </Stack>
        ))}
      </Stack>
    </Radio.Group>
  )
}
