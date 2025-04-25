import type { Meta, StoryObj } from '@storybook/react'
import Checkbox from './checkbox'

const meta: Meta<typeof Checkbox> = {
  title: 'Design system old/Checkbox',
  component: Checkbox,
  argTypes: {
    label: { type: 'string' },
    checked: { type: 'boolean' },
    onChange: { action: 'changed' },
  },
}

export default meta

type Story = StoryObj<typeof Checkbox>

export const Default: Story = {
  args: {
    label: 'Checkbox',
    checked: false,
  },
}
