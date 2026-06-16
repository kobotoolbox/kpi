import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { withRouter } from 'storybook-addon-remix-react-router'
import bulkActionFactory from '#/endpoints/bulkAction.factory'
import BulkProcessingBanner from './BulkProcessingBanner'
import { withBulkProcessingBannerSessionReset } from './BulkProcessingBannerStoriesUtils'

const singleJobByCurrentUser = [bulkActionFactory('uuid-1', 'en', { created_by: { username: 'storybook-user' } })]
const singleJobByAnotherUser = [bulkActionFactory('uuid-1', 'en', { created_by: { username: 'other-user' } })]
const multipleJobs = [
  bulkActionFactory('uuid-1', 'en', { created_by: { username: 'storybook-user' } }),
  bulkActionFactory('uuid-2', 'fr', { created_by: { username: 'other-user' } }),
  bulkActionFactory('uuid-3', 'es', { created_by: { username: 'another-user' } }),
]
const meta: Meta<typeof BulkProcessingBanner> = {
  title: 'Components/BulkProcessingBanner',
  component: BulkProcessingBanner,
  decorators: [withRouter, withBulkProcessingBannerSessionReset],
  args: {
    assetUid: 'asset-uid-story',
    currentUsername: 'storybook-user',
    hasActiveBulkActionsCreatedByCurrentUser: true,
    activeBulkActions: singleJobByCurrentUser,
  },
  parameters: {
    a11y: { test: 'todo' },
  },
}

export default meta

type Story = StoryObj<typeof BulkProcessingBanner>

export const SingleJobByCurrentUser: Story = {
  args: {
    hasActiveBulkActionsCreatedByCurrentUser: true,
    activeBulkActions: singleJobByCurrentUser,
  },
}

export const SingleJobByAnotherUser: Story = {
  args: {
    hasActiveBulkActionsCreatedByCurrentUser: false,
    activeBulkActions: singleJobByAnotherUser,
  },
}

export const MultipleJobs: Story = {
  args: {
    hasActiveBulkActionsCreatedByCurrentUser: true,
    activeBulkActions: multipleJobs,
  },
}
