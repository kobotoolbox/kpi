import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { fn } from 'storybook/test'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import ProfileDetailsErrorScreen from './ProfileDetailsErrorScreen'

/** What the user gets when the organization request failed and `useProfileDetailsBlockerState` has no answer. */
const meta: Meta<typeof ProfileDetailsErrorScreen> = {
  title: 'Features/ProfileDetailsErrorScreen',
  component: ProfileDetailsErrorScreen,
  // Docs view can't render a full page frame usefully
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    onRetry: fn(),
  },
  decorators: [queryClientDecorator],
}

export default meta
type Story = StoryObj<typeof ProfileDetailsErrorScreen>

export const Default: Story = {}
