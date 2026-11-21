import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { useState } from 'react'
import MultiCheckbox, { type MultiCheckboxItem } from './multiCheckbox'

const items: MultiCheckboxItem[] = [
  { label: 'I am a checkbox', checked: false },
  { label: 'I am a checked checkbox', checked: true },
  { label: 'I am a checkbox with a hint', checked: false, hint: 'Some extra explanation' },
  { label: 'I am a disabled checkbox', checked: false, disabled: true },
  { label: 'I am a disabled checked checkbox', checked: true, disabled: true },
]

const meta: Meta<typeof MultiCheckbox> = {
  title: 'Design system/MultiCheckbox',
  component: MultiCheckbox,
  args: { type: 'bare', items },
  // Keeps the list in local state, so clicking works
  render: function Render(args) {
    const [currentItems, setCurrentItems] = useState(args.items)
    return <MultiCheckbox {...args} items={currentItems} onChange={setCurrentItems} />
  },
}

export default meta

type Story = StoryObj<typeof MultiCheckbox>

export const Bare: Story = {}

export const Frame: Story = {
  args: { type: 'frame' },
}

export const Disabled: Story = {
  args: { disabled: true },
}
