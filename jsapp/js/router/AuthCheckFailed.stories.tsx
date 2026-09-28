import type { Meta, StoryObj } from '@storybook/react-webpack5'
import AuthCheckFailed from './AuthCheckFailed'

/** What the app puts up when the `/me/` check failed, and it cannot tell whether anybody is signed in */
const meta: Meta<typeof AuthCheckFailed> = {
  title: 'Features/AuthCheckFailed',
  component: AuthCheckFailed,
  // Docs view can't render a full page usefully
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof AuthCheckFailed>

export const Default: Story = {}
