import { type MantineSize, Stack } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, fn, userEvent, within } from 'storybook/test'
import DatePickerInput from './DatePickerInput'

const sizes: MantineSize[] = ['sm', 'md', 'lg']

const meta: Meta<typeof DatePickerInput> = {
  title: 'Design system/DatePickerInput',
  component: DatePickerInput,
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    size: { options: sizes, control: { type: 'radio' } },
    clearable: { control: 'boolean' },
    disabled: { control: 'boolean' },
    error: { control: 'text' },
  },
  args: {
    label: 'Date deployed',
    placeholder: 'Select date',
    // Fixed month, so the calendar (and Chromatic snapshot) doesn't follow today's date.
    defaultDate: '2026-11-01',
    onChange: fn(),
  },
}
export default meta

type Story = StoryObj<typeof DatePickerInput>

export const Primary: Story = {}

export const WithValue: Story = {
  args: { defaultValue: '2026-11-11', clearable: true },
}

export const Disabled: Story = {
  args: { disabled: true },
}

export const WithError: Story = {
  args: { error: 'Date is required' },
}

export const Sizes: Story = {
  render: (args) => (
    <Stack>
      {sizes.map((size) => (
        <DatePickerInput key={size} {...args} size={size} label={`Size ${size}`} />
      ))}
    </Stack>
  ),
}

export const PickingDate: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // Wait for the lazy chunk to replace the read-only fallback.
    await userEvent.click(await canvas.findByRole('button', { name: 'Date deployed' }))
    // The dropdown renders in a portal, outside of the canvas.
    const body = within(document.body)
    await userEvent.click(await body.findByRole('button', { name: '11 November 2026' }))

    await expect(args.onChange).toHaveBeenCalledWith('2026-11-11')
    await expect(canvas.getByRole('button', { name: 'Date deployed' })).toHaveTextContent('Nov 11, 2026')
  },
}
