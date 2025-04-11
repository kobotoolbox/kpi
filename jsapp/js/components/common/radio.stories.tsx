import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import Radio from './radio'
import type { RadioOption } from './radio'

const defaultOptions: RadioOption[] = [
  {
    label: 'Pizza',
    value: 'pizza',
  },
  {
    label: 'Peanut butter and jelly sandwich',
    value: 'pbj_sandwich',
  },
  {
    label: 'Apple pie',
    value: 'apple_pie',
    isDisabled: true,
  },
  {
    label: 'Banana',
    value: 'banana',
  },
]

const meta: Meta<typeof Radio> = {
  title: 'Design system old/Radio',
  component: Radio,
  argTypes: {},
}

export default meta

type Story = StoryObj<typeof Radio>

export const Primary: Story = {
  render: (args) => {
    const [selected, setSelected] = useState('')
    return (
      <Radio
        {...args}
        selected={selected}
        onChange={(newSelectedValue) => setSelected(newSelectedValue)}
        options={defaultOptions}
      />
    )
  },
  args: {
    title: 'Pick your favourite food',
  },
}
