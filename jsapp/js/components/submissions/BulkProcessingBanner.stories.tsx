import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { withRouter } from 'storybook-addon-remix-react-router'
import { getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock } from '#/api/react-query/survey-data/msw'
import BulkProcessingBanner from './BulkProcessingBanner'
import { withBulkProcessingBannerSessionReset } from './BulkProcessingBannerStoriesUtils'

const singleJobByCurrentUser = [
  getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock({
    submission_uuids: ['uuid-1'],
    params: { language: 'en' },
    created_by: { username: 'storybook-user' },
  }),
]
const singleJobByAnotherUser = [
  getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock({
    submission_uuids: ['uuid-1'],
    params: { language: 'en' },
    created_by: { username: 'other-user' },
  }),
]
const multipleJobs = [
  getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock({
    submission_uuids: ['uuid-1'],
    params: { language: 'en' },
    created_by: { username: 'storybook-user' },
  }),
  getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock({
    submission_uuids: ['uuid-2'],
    params: { language: 'fr' },
    created_by: { username: 'other-user' },
  }),
  getApiV2AssetsAdvancedFeaturesBulkActionsRetrieveResponseMock({
    submission_uuids: ['uuid-3'],
    params: { language: 'es' },
    created_by: { username: 'another-user' },
  }),
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
