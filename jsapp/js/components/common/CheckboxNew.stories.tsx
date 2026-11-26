import { type MantineSize, Stack } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, within } from 'storybook/test'
import CheckboxNew from './CheckboxNew'

/** Expected box and label in px: the box one step below Mantine's, the label at Mantine's size. */
const SIZES: Array<{ size: MantineSize; box: number; label: number }> = [
  { size: 'xs', box: 14, label: 12 },
  { size: 'sm', box: 16, label: 13 },
  { size: 'md', box: 20, label: 14 },
  { size: 'lg', box: 24, label: 16 },
  { size: 'xl', box: 30, label: 18 },
]

type Story = StoryObj<typeof CheckboxNew>

const meta: Meta<typeof CheckboxNew> = {
  title: 'Design system/CheckboxNew',
  component: CheckboxNew,
  args: { label: 'I agree with the Terms of Service' },
}

export default meta

export const Default: Story = {}

/** The asterisk stays out of the accessible name, screen readers get `required` from the input. */
export const Required: Story = {
  args: { required: true },
}

export const RequiredWithoutAsterisk: Story = {
  args: { required: true, withAsterisk: false },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).queryByText('*')).not.toBeInTheDocument()
  },
}

/** Every size at once, required so the asterisk shows too */
export const AllSizes: Story = {
  render: () => (
    <Stack gap='md'>
      {SIZES.map(({ size }) => (
        <CheckboxNew key={size} size={size} label={`Size ${size}`} required />
      ))}
    </Stack>
  ),
}
