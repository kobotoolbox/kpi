import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { withRouter } from 'storybook-addon-remix-react-router'
import TextWithInternalLink from './TextWithInternalLink'

const meta: Meta<typeof TextWithInternalLink> = {
  title: 'Design System/TextWithInternalLink',
  component: TextWithInternalLink,
  decorators: [withRouter],
  args: {
    text: '[Click here] to view your settings',
    path: '/account/settings',
  },
  parameters: {
    a11y: { test: 'todo' },
  },
}

export default meta
type Story = StoryObj<typeof TextWithInternalLink>

export const Default: Story = {
  args: {
    text: '[Click here] to view your settings',
    path: '/account/settings',
  },
}

export const LinkAtEnd: Story = {
  args: {
    text: 'Go to the activity log by clicking [here]',
    path: '/activity',
  },
}

export const LinkAtStart: Story = {
  args: {
    text: '[View details] to see more information about this feature',
    path: '/details',
  },
}

export const LongText: Story = {
  args: {
    text: 'Your bulk transcription job is running. [Click here] to monitor your progress or to cancel this job.',
    path: '/activity',
  },
}

export const NoBrackets: Story = {
  args: {
    text: 'This text has no brackets so it displays as plain text',
    path: '/nowhere',
  },
}
