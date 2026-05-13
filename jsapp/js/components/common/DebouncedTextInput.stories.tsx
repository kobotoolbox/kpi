import type { Meta, StoryObj } from '@storybook/react-webpack5'
import React from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import DebouncedTextInput from './DebouncedTextInput'
import type { DebouncedTextInputProps } from './DebouncedTextInput'

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
    onBlur: fn(),
    onFocus: fn(),
    onKeyDown: fn(),
  },
  parameters: { a11y: { test: 'todo' } },
}

export default meta

type Story = StoryObj<typeof DebouncedTextInput>

/** Wraps a story to display the last value committed by the debounce. */
function WithCommittedValue(props: DebouncedTextInputProps) {
  const [committed, setCommitted] = React.useState<string | undefined>(undefined)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <DebouncedTextInput
        {...props}
        onChange={(value) => {
          setCommitted(value)
          props.onChange?.(value)
        }}
      />
      <small>Last committed value: &quot;{committed ?? '—'}&quot;</small>
    </div>
  )
}

export const Default: Story = {
  args: {
    label: 'Search',
    placeholder: 'Type to search…',
  },
  render: (args) => <WithCommittedValue {...args} />,
}

export const CustomTimeout: Story = {
  args: {
    label: 'Fast debounce (200 ms)',
    placeholder: 'Type to search…',
    debounceTimeout: 200,
  },
  render: (args) => <WithCommittedValue {...args} />,
}

export const NoImmediateFlush: Story = {
  args: {
    label: 'No immediate flush on blur / Enter',
    placeholder: 'Type to search…',
    // Intentionally long to test Enter key
    debounceTimeout: 1000,
    forceNotifyByEnter: false,
    forceNotifyOnBlur: false,
  },
  render: (args) => <WithCommittedValue {...args} />,
}

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    placeholder: 'Not editable',
    disabled: true,
    value: 'pre-filled value',
  },
}

/** Typing fires onChange only after the debounce delay, not on every keystroke. */
export const TestDebounceDelay: Story = {
  args: {
    label: 'Debounce delay test',
    placeholder: 'Type to search…',
    debounceTimeout: 200,
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByPlaceholderText('Type to search…')

    await userEvent.type(input, 'hel', { delay: 30 })

    // onChange must not have been called yet — still within the debounce window
    await expect(args.onChange).not.toHaveBeenCalled()

    // Wait for the debounce to settle
    await waitFor(() => expect(args.onChange).toHaveBeenCalledTimes(1), { timeout: 1000 })
    await expect(args.onChange).toHaveBeenLastCalledWith('hel')
  },
}

/** Pressing Enter flushes the pending debounce immediately. */
export const TestEnterFlush: Story = {
  args: {
    label: 'Enter flush test',
    placeholder: 'Type to search…',
    debounceTimeout: 2000,
    forceNotifyByEnter: true,
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByPlaceholderText('Type to search…')

    await userEvent.type(input, 'hello')

    // onChange should not have fired yet (debounce is 2 s)
    await expect(args.onChange).not.toHaveBeenCalled()

    await userEvent.keyboard('{Enter}')

    await expect(args.onChange).toHaveBeenCalledTimes(1)
    await expect(args.onChange).toHaveBeenLastCalledWith('hello')
  },
}

/** Moving focus away (blur) flushes the pending debounce immediately. */
export const TestBlurFlush: Story = {
  args: {
    label: 'Blur flush test',
    placeholder: 'Type to search…',
    debounceTimeout: 2000,
    forceNotifyOnBlur: true,
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByPlaceholderText('Type to search…')

    await userEvent.type(input, 'world')

    // onChange should not have fired yet (debounce is 2 s)
    await expect(args.onChange).not.toHaveBeenCalled()

    await userEvent.tab()

    await expect(args.onChange).toHaveBeenCalledTimes(1)
    await expect(args.onChange).toHaveBeenLastCalledWith('world')
  },
}
