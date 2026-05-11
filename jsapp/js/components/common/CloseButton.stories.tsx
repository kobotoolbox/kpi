import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { ForwardRefExoticComponent } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { StoryArgsFromPolymorphic } from '#/storybookUtils'
import CloseButton, { type CloseButtonProps } from './CloseButton'

type StoryArgs = StoryArgsFromPolymorphic<'button', CloseButtonProps>
type Story = StoryObj<ForwardRefExoticComponent<StoryArgs>>

const meta: Meta<typeof CloseButton> = {
  title: 'Design system/CloseButton',
  component: CloseButton,
  argTypes: {
    size: {
      description: 'Size of close button',
      options: ['xs', 'sm', 'md', 'lg'],
      control: 'select',
    },
    onClick: { action: 'clicked' },
    disabled: { control: 'boolean' },
    tooltip: { description: 'Tooltip text', control: 'text' },
    'aria-label': { description: 'Aria label for accessibility', control: 'text' },
  },
  args: {
    onClick: fn(),
    'aria-label': 'Close',
  },
}

export default meta

export const Default: Story = {}

export const WithTooltip: Story = {
  args: {
    tooltip: 'Close this dialog',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <CloseButton size='xs' aria-label='Close' />
      <CloseButton size='sm' aria-label='Close' />
      <CloseButton size='md' aria-label='Close' />
      <CloseButton size='lg' aria-label='Close' />
    </div>
  ),
}

export const Interaction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button')

    await userEvent.click(button)
    await expect(args.onClick).toHaveBeenCalled()
  },
}
