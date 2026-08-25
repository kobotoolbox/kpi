import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { useState } from 'react'
import PasswordInput from './PasswordInput'

type Story = StoryObj<typeof PasswordInput>

const meta: Meta<typeof PasswordInput> = {
  title: 'Design system/PasswordInput',
  component: PasswordInput,
  argTypes: {
    defaultVisible: {
      control: 'boolean',
      description: 'Whether the password is revealed on first render (uncontrolled)',
    },
    visible: {
      control: 'boolean',
      description: 'Controls the reveal state. Pair with `onVisibilityChange`',
    },
  },
}

export default meta

export const Default: Story = {
  args: {
    label: 'Current Password',
    placeholder: 'Type your password',
  },
}

export const Controlled: Story = {
  args: {
    label: 'New Password',
    placeholder: 'Type your password',
  },
  render: (args) => {
    const [value, setValue] = useState('')
    return <PasswordInput {...args} value={value} onChange={(event) => setValue(event.currentTarget.value)} />
  },
}

export const WithError: Story = {
  args: {
    label: 'Verify Password',
    value: 'mismatch',
    error: 'Passwords do not match',
  },
}

export const Disabled: Story = {
  args: {
    label: 'Current Password',
    value: 'you cannot edit this',
    disabled: true,
  },
}
