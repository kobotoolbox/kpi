import { type MantineSize, SimpleGrid, Stack, Text } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { Fragment } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import DatePickerInput, { DatePickerInputFallback, type DatePickerInputProps } from './DatePickerInput'

const sizes: MantineSize[] = ['sm', 'md', 'lg']

const meta: Meta<typeof DatePickerInput> = {
  title: 'Design system/DatePickerInput',
  component: DatePickerInput,
  tags: ['!autodocs'],
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
  parameters: { a11y: { disable: true } },
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

const comparisonRows: Array<{ name: string; props: Partial<DatePickerInputProps> }> = [
  { name: 'Placeholder', props: {} },
  { name: 'With value', props: { defaultValue: '2026-11-11', clearable: true } },
  { name: 'Disabled', props: { disabled: true } },
  { name: 'With error', props: { error: 'Date is required' } },
  { name: 'Size sm', props: { size: 'sm' } },
  { name: 'Size lg', props: { size: 'lg' } },
]

/** The loading fallback next to the picker. They should look the same, so nothing flickers on load. */
export const FallbackComparison: Story = {
  render: (args) => (
    <SimpleGrid cols={2}>
      <Text fw={500}>Fallback (while loading)</Text>
      <Text fw={500}>Picker</Text>
      {comparisonRows.map((row) => (
        <Fragment key={row.name}>
          <div data-testid='fallback'>
            <DatePickerInputFallback {...args} {...row.props} label={row.name} />
          </div>
          <div data-testid='picker'>
            <DatePickerInput {...args} {...row.props} label={row.name} />
          </div>
        </Fragment>
      ))}
    </SimpleGrid>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-dates-input]')).toHaveLength(comparisonRows.length),
    )
    const fallbacks = canvas.getAllByTestId('fallback')
    const pickers = canvas.getAllByTestId('picker')

    fallbacks.forEach((fallback, index) => {
      const fallbackInput = fallback.querySelector('input')!
      const pickerInput = pickers[index].querySelector<HTMLElement>('[data-dates-input]')!
      // Whole field, so label and error count too.
      expect(fallback.getBoundingClientRect().height).toBe(pickers[index].getBoundingClientRect().height)
      expect(getComputedStyle(fallbackInput).backgroundColor).toBe(getComputedStyle(pickerInput).backgroundColor)
      expect(fallbackInput.value || fallbackInput.placeholder).toBe(pickerInput.textContent)
    })
  },
}
