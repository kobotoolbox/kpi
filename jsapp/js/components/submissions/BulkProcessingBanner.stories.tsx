import type { Meta, StoryObj } from '@storybook/react-webpack5'
import BulkProcessingBanner from './BulkProcessingBanner'

const meta: Meta<typeof BulkProcessingBanner> = {
  title: 'Components/Submissions/BulkProcessingBanner',
  component: BulkProcessingBanner,
  parameters: {
    a11y: { test: 'todo' },
  },
  args: {
    isVisible: true,
    activeBulkActionsCount: 1,
  },
}

export default meta

type Story = StoryObj<typeof BulkProcessingBanner>

export const Hidden: Story = {
  args: {
    isVisible: false,
    activeBulkActionsCount: 2,
  },
}

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
