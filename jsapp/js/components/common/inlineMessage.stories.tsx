import type { Meta, StoryObj } from '@storybook/react'
import InlineMessage from '#/components/common/inlineMessage'

const meta: Meta<typeof InlineMessage> = {
  title: 'Design system old/InlineMessage',
  component: InlineMessage,
  argTypes: {},
}

export default meta

type Story = StoryObj<typeof InlineMessage>

export const Primary: Story = {
  args: {
    type: 'default',
    message:
      'If debugging is the process of removing software bugs, then programming must be the process of putting them in.',
  },
}

export const Demo: Story = {
  render: () => {
    const message =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam'
    return (
      <div>
        <InlineMessage type='default' message={message} />
        <InlineMessage icon='alert' type='default' message={message} />
        <InlineMessage icon='alert' type='error' message={message} />
        <InlineMessage icon='alert' type='info' message={message} />
        <InlineMessage icon='alert' type='success' message={message} />
        <InlineMessage icon='alert' type='warning' message={message} />
      </div>
    )
  },
}
