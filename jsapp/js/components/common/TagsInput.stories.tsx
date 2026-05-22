import { Stack } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import TagsInput from './TagsInput'

const meta: Meta<typeof TagsInput> = {
  title: 'Design system/TagsInput',
  component: TagsInput,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520, padding: 40, margin: 'auto' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    label: 'Tags',
    placeholder: 'Type and confirm with ENTER',
    value: [],
  },
}

type Story = StoryObj<typeof TagsInput>

export const Basic: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value ?? [])
    return <TagsInput label={args.label} placeholder={args.placeholder} value={value} onChange={setValue} />
  },
}

export const PresetValues: Story = {
  render: (args) => {
    const [value, setValue] = useState(['Health', 'Humanitarian', 'Field-ops'])

    return (
      <Stack>
        <TagsInput label={args.label} placeholder={args.placeholder} value={value} onChange={setValue} />
        <div>Current value: {value.join(',') || '(empty)'}</div>
      </Stack>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Tags' })

    await userEvent.type(input, 'Water{enter}')
    await expect(canvas.getByText('Current value: Health,Humanitarian,Field-ops,Water')).toBeInTheDocument()

    const removeButtons = canvas.getAllByRole('button')
    await userEvent.click(removeButtons[removeButtons.length - 1])
    await expect(canvas.getByText('Current value: Health,Humanitarian,Field-ops')).toBeInTheDocument()
  },
}

export default meta
