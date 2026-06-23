import { Stack, Text } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react'
import BulkProcessingAlerts from './BulkProcessingAlerts'
import type { ActiveAlert } from './types'

const meta = {
  title: 'Submissions/BulkProcessingAlerts',
  component: BulkProcessingAlerts,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof BulkProcessingAlerts>

export default meta
type Story = StoryObj<typeof meta>

// Mock alerts for demonstration
const mockErrorAlert: ActiveAlert = {
  id: 'reached-limit',
  type: 'error',
  message:
    'You have reached your transcription limit. Please select fewer files, purchase an add-on, or upgrade your plan.',
  computedValues: {},
}

const mockNearLimitAlert: ActiveAlert = {
  id: 'near-limit',
  type: 'error',
  message:
    '5 minutes of automated transcription left, that is not enough to process all selected submissions. Please select fewer files, purchase an add-on, or upgrade your plan.',
  computedValues: { remainingMinutes: 5 },
}

const mockWarningAlreadyTranscribed: ActiveAlert = {
  id: 'already-transcribed',
  type: 'warning',
  message: '3 audio files totaling 15 minutes already transcribed and will be ignored',
  computedValues: { count: 3, minutes: 15 },
}

const mockWarningNoSource: ActiveAlert = {
  id: 'no-source',
  type: 'warning',
  message: '2 submissions are missing audio file and will be ignored',
  computedValues: { count: 2 },
}

const mockWarningConflicting: ActiveAlert = {
  id: 'conflicting-job',
  type: 'warning',
  message: 'Another bulk process is already in progress, please let it finish first',
  computedValues: {},
}

const mockErrorNoEligible: ActiveAlert = {
  id: 'no-eligible-submissions',
  type: 'error',
  message: 'No submissions to process, see alerts above.',
  computedValues: { totalCount: 5, filteredCount: 5 },
}

/**
 * Default state with no alerts
 */
export const NoAlerts: Story = {
  args: {
    activeAlerts: [],
  },
  render: (args) => (
    <Stack gap='md'>
      <Text size='sm'>No alerts to display - all validations passed</Text>
      <BulkProcessingAlerts {...args} />
    </Stack>
  ),
}

/**
 * Single error alert - Reached limit
 */
export const ReachedLimit: Story = {
  args: {
    activeAlerts: [mockErrorAlert],
  },
}

/**
 * Single error alert - Near limit
 */
export const NearLimit: Story = {
  args: {
    activeAlerts: [mockNearLimitAlert],
  },
}

/**
 * Single warning alert - Already transcribed
 */
export const AlreadyTranscribed: Story = {
  args: {
    activeAlerts: [mockWarningAlreadyTranscribed],
  },
}

/**
 * Multiple warnings
 */
export const MultipleWarnings: Story = {
  args: {
    activeAlerts: [mockWarningAlreadyTranscribed, mockWarningNoSource],
  },
}

/**
 * Warning with conflicting job
 */
export const ConflictingJob: Story = {
  args: {
    activeAlerts: [mockWarningConflicting],
  },
}

/**
 * Error + Warnings combination
 */
export const ErrorWithWarnings: Story = {
  args: {
    activeAlerts: [mockNearLimitAlert, mockWarningAlreadyTranscribed, mockWarningNoSource],
  },
}

/**
 * All filtered out - No eligible submissions
 */
export const NoEligibleSubmissions: Story = {
  args: {
    activeAlerts: [mockWarningAlreadyTranscribed, mockWarningNoSource, mockErrorNoEligible],
  },
}

/**
 * Translation-specific alerts
 */
export const TranslationAlerts: Story = {
  args: {
    activeAlerts: [
      {
        id: 'already-translated',
        type: 'warning',
        message: '4 transcripts totaling 1,250 characters already translated and will be ignored',
        computedValues: { count: 4, characters: 1250 },
      },
      {
        id: 'no-source',
        type: 'warning',
        message: '1 submission is missing transcription and will be ignored',
        computedValues: { count: 1 },
      },
    ],
  },
}

/**
 * All alert types (for visual testing)
 */
export const AllAlertTypes: Story = {
  args: {
    activeAlerts: [
      mockErrorAlert,
      mockNearLimitAlert,
      mockWarningConflicting,
      mockWarningNoSource,
      mockWarningAlreadyTranscribed,
      mockErrorNoEligible,
    ],
  },
  render: (args) => (
    <Stack gap='md'>
      <Text size='sm' fw={600}>
        Showing all alert types (not a realistic scenario)
      </Text>
      <BulkProcessingAlerts {...args} />
    </Stack>
  ),
}
