import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { useState } from 'react'
import Textarea from './Textarea'

type Story = StoryObj<typeof Textarea>

const meta: Meta<typeof Textarea> = {
  title: 'Design system/Textarea',
  component: Textarea,
  argTypes: {
    autosize: {
      control: 'boolean',
      description: 'Automatically adjusts height to fit content',
    },
    minRows: {
      control: 'number',
      description: 'Minimum number of visible rows when autosize is enabled',
    },
    maxRows: {
      control: 'number',
      description: 'Maximum number of visible rows when autosize is enabled',
    },
  },
}

export default meta

export const Default: Story = {
  args: {
    label: 'Notes',
    placeholder: 'Type your notes here',
  },
}

export const Autosize: Story = {
  args: {
    label: 'Translation',
    placeholder: 'Type multiple lines to see autosize',
    autosize: true,
    minRows: 2,
    maxRows: 8,
  },
  render: (args) => {
    const [value, setValue] = useState('')
    return <Textarea {...args} value={value} onChange={(event) => setValue(event.currentTarget.value)} />
  },
}

export const WithError: Story = {
  args: {
    label: 'Translation',
    value: '',
    error: 'This field is required',
    autosize: true,
    minRows: 2,
  },
}
