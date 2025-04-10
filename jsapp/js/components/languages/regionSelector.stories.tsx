import type { Meta, StoryObj } from '@storybook/react'
import RegionSelector from './regionSelector'

const meta: Meta<typeof RegionSelector> = {
  title: 'Components/RegionSelector',
  component: RegionSelector,
  argTypes: {
    rootLanguage: { control: 'text' },
    isDisabled: { control: 'boolean' },
  },
}

export default meta

type Story = StoryObj<typeof RegionSelector>

export const Primary: Story = {
  args: {
    rootLanguage: 'en',
    isDisabled: false,
  },
}
