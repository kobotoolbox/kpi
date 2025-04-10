import type { Meta, StoryObj } from '@storybook/react'
import KoboRange, { KoboRangeColors } from '#/components/common/koboRange'

const meta: Meta<typeof KoboRange> = {
  title: 'Design system old/KoboRange',
  component: KoboRange,
  argTypes: {
    color: {
      options: Object.keys(KoboRangeColors),
      control: { type: 'select' },
    },
    max: { type: 'number' },
    value: { type: 'number' },
    onChange: { action: 'changed' },
  },
}

export default meta

type Story = StoryObj<typeof KoboRange>

export const Default: Story = {
  args: {
    color: KoboRangeColors.default,
    totalLabel: '',
    currentLabel: '',
    max: 10,
    value: 4,
    isTime: false,
    isDisabled: false,
  },
}
