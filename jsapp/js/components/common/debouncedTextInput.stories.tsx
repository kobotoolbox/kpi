import type { Meta, StoryObj } from '@storybook/react-webpack5'
import React from 'react'
import { fn } from 'storybook/test'
import DebouncedTextInput from './debouncedTextInput'

const meta: Meta<typeof DebouncedTextInput> = {
  title: 'Design system/DebouncedTextInput',
  component: DebouncedTextInput,
  argTypes: {
    debounceTimeout: {
      description: 'Milliseconds to wait after the last keystroke before calling onChange',
      control: { type: 'number' },
    },
    forceNotifyByEnter: {
      description: 'Fire onChange immediately when Enter is pressed',
      control: { type: 'boolean' },
    },
    forceNotifyOnBlur: {
      description: 'Fire onChange immediately when the input loses focus',
      control: { type: 'boolean' },
    },
    placeholder: {
      control: { type: 'text' },
    },
    label: {
      control: { type: 'text' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
  args: {
    onChange: fn(),
  },
  parameters: { a11y: { test: 'todo' } },
}

export default meta

type Story = StoryObj<typeof DebouncedTextInput>

export const Default: Story = {
  args: {
    label: 'Search',
    placeholder: 'Type to search…',
    debounceTimeout: 750,
  },
}

export const CustomTimeout: Story = {
  args: {
    label: 'Fast debounce (200 ms)',
    placeholder: 'Type to search…',
    debounceTimeout: 200,
  },
}

export const NoImmediateFlush: Story = {
  args: {
    label: 'No immediate flush on blur / Enter',
    placeholder: 'Type to search…',
    debounceTimeout: 750,
    forceNotifyByEnter: false,
    forceNotifyOnBlur: false,
  },
}

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    placeholder: 'Not editable',
    disabled: true,
    value: 'pre-filled value',
  },
}

/** Shows the last debounced value committed to a parent component. */
export const WithCommittedValueDisplay: Story = {
  args: {
    label: 'Live debounce demo',
    placeholder: 'Type something…',
    debounceTimeout: 750,
  },
  render: (args) => {
    const [committed, setCommitted] = React.useState('')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DebouncedTextInput
          {...args}
          onChange={(value) => {
            setCommitted(value)
            args.onChange(value)
          }}
        />
        <small>Last committed value: &quot;{committed}&quot;</small>
      </div>
    )
  },
}
