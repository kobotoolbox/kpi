import { Radio, Stack } from '@mantine/core'
import React, { type ChangeEvent } from 'react'

export interface RadioGroupOption {
  uuid: string
  label: string
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
          <Radio
            key={option.uuid}
            value={option.uuid}
            label={`${option.label}`}
            onChange={handleChange}
            checked={value === option.uuid}
            disabled={disabled || option.disabled}
          />
        ))}
      </Stack>
    </Radio.Group>
  )
}
