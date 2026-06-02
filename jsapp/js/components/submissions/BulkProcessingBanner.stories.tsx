import type { Meta, StoryObj } from '@storybook/react-webpack5'
import BulkProcessingBanner from './BulkProcessingBanner'
import { withBulkProcessingBannerSessionReset } from './BulkProcessingBannerStoriesUtils'

const meta: Meta<typeof BulkProcessingBanner> = {
  title: 'Components/BulkProcessingBanner',
  component: BulkProcessingBanner,
  decorators: [withBulkProcessingBannerSessionReset],
  args: {
    assetUid: 'asset-uid-story',
    currentUsername: 'storybook-user',
    hasActiveBulkActionsCreatedByAnotherUser: true,
    activeBulkActionsCount: 1,
  },
  parameters: {
    a11y: { test: 'todo' },
  },
}

export default meta

type Story = StoryObj<typeof BulkProcessingBanner>

export const SingleJob: Story = {
  args: {
    hasActiveBulkActionsCreatedByAnotherUser: true,
    activeBulkActionsCount: 1,
  },
}

export const MultipleJobs: Story = {
  args: {
    hasActiveBulkActionsCreatedByAnotherUser: true,
    activeBulkActionsCount: 3,
  },
}
