import type { Meta, StoryObj } from '@storybook/react'
import MultiCheckbox from './multiCheckbox'

const meta: Meta<typeof MultiCheckbox> = {
  title: 'Design system old/MultiCheckbox',
  component: MultiCheckbox,
  argTypes: {},
  args: {},
}

export default meta

type Story = StoryObj<typeof MultiCheckbox>

export const Primary: Story = {
  args: {
    type: 'bare',
  },
  render: (args) => (
    <MultiCheckbox
      {...args}
      items={[
        { label: 'I am a checkbox', checked: false },
        { label: 'I am a checked checkbox', checked: true },
        { label: 'I am a disabled checkbox', checked: false, disabled: true },
        { label: 'I am a disabled checked checkbox', checked: true, disabled: true },
      ]}
    />
  ),
}
