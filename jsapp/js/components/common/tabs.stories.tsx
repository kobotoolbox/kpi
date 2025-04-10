import type { Meta, StoryObj } from '@storybook/react'
import Tabs from './tabs'

const meta: Meta<typeof Tabs> = {
  title: 'Design system old/Tabs',
  component: Tabs,
  argTypes: {
    tabs: {
      description: 'Array of tab objects which contain strings defining the label and route',
      control: 'object',
    },
    selectedTab: {
      description: 'Defines the active tab for navigation and styling purposes',
      control: 'text',
    },
    onChange: {
      description: 'Tab change callback',
    },
  },
  parameters: {
    docs: {
      description: {
        component: 'This is a component that provides a top tab navigation menu.',
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof Tabs>

const tabsData = [
  { label: 'Tab 1', route: '/tab1' },
  { label: 'Tab 2', route: '/tab2' },
  { label: 'Tab 3', route: '/tab3' },
]

export const Default: Story = {
  args: {
    tabs: tabsData,
    selectedTab: '/tab1',
  },
}

export const SelectedTab2: Story = {
  args: {
    ...Default.args,
    selectedTab: '/tab2',
  },
}
