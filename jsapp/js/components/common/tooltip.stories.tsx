import type { Meta, StoryObj } from '@storybook/react'
import type { TooltipAlignment } from './tooltip'
import Tooltip from './tooltip'

const tooltipPositions: TooltipAlignment[] = ['right', 'left', 'center']

const meta: Meta<typeof Tooltip> = {
  title: 'Design system old/Tooltip',
  component: Tooltip,
  argTypes: {
    text: {
      description: 'Content of the tooltip shown on hover over button',
      control: 'text',
    },
    alignment: {
      description: 'Position of the tooltip (centered as default)',
      options: tooltipPositions,
      control: 'radio',
    },
    ariaLabel: {
      description: 'Accessible label for screen readers',
    },
  },
  parameters: {
    docs: {
      description: {
        component: 'This is a component that displays a tooltip on a button that is hovered over.',
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof Tooltip>

export const Default: Story = {
  args: {
    text: 'Default Tooltip Text',
    alignment: 'center',
    ariaLabel: 'Default Tooltip Text',
  },
  render: (args) => (
    <Tooltip {...args}>
      <button>Your Button</button>
    </Tooltip>
  ),
}

export const Right: Story = {
  args: {
    text: 'Right Aligned Tooltip Text',
    alignment: 'right',
    ariaLabel: 'Right Aligned Tooltip Text',
  },
  render: (args) => (
    <Tooltip {...args}>
      <button>Your Button</button>
    </Tooltip>
  ),
}

export const Left: Story = {
  args: {
    text: 'Left Aligned Tooltip Text',
    alignment: 'left',
    ariaLabel: 'Left Aligned Tooltip Text',
  },
  render: (args) => (
    <Tooltip {...args}>
      <button>Your Button</button>
    </Tooltip>
  ),
}
