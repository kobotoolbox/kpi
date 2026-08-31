import type { Meta, StoryObj } from '@storybook/react-webpack5'
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
  parameters: {
    a11y: { disable: true },
  },
}

export default meta

export const Default: Story = {
  args: {
    label: 'Current Password',
    placeholder: 'Type your password',
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
