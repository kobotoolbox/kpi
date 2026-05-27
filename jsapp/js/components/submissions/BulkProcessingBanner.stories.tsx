import type { Meta, StoryObj } from '@storybook/react-webpack5'
import BulkProcessingBanner from './BulkProcessingBanner'
import { withBulkProcessingBannerSessionReset } from './bulkProcessingBanner.storiesUtils'

const meta: Meta<typeof BulkProcessingBanner> = {
  title: 'Components/BulkProcessingBanner',
  component: BulkProcessingBanner,
  decorators: [withBulkProcessingBannerSessionReset],
  args: {
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
