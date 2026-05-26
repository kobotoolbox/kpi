import type { Meta, StoryObj } from '@storybook/react-webpack5'
import BulkProcessingBanner from './BulkProcessingBanner'

const meta: Meta<typeof BulkProcessingBanner> = {
  title: 'Components/BulkProcessingBanner',
  component: BulkProcessingBanner,
  args: {
    assetUid: 'asset-uid-story',
    isVisible: true,
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
    isVisible: true,
    activeBulkActionsCount: 1,
  },
}

export const MultipleJobs: Story = {
  args: {
    isVisible: true,
    activeBulkActionsCount: 3,
  },
}

export const Hidden: Story = {
  args: {
    isVisible: false,
    activeBulkActionsCount: 2,
  },
}
