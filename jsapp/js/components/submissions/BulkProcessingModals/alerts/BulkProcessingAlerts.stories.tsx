import { Stack, Text } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react'
import { getAlertDefinitions } from './alertDefinitions'
import BulkProcessingAlerts from './BulkProcessingAlerts'
import type { ActiveAlert } from './types'

const meta = {
  title: 'Components/BulkProcessingAlerts',
  component: BulkProcessingAlerts,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof BulkProcessingAlerts>

export default meta
type Story = StoryObj<typeof meta>

// Get alert definitions for creating realistic mock alerts
const transcriptionAlerts = getAlertDefinitions('transcript')
const translationAlerts = getAlertDefinitions('translation')

// Helper to create mock alert from definition
function createMockAlert(alertId: string, computedValues: Record<string, any>, actionType: 'transcript' | 'translation' = 'transcript'): ActiveAlert {
  const alerts = actionType === 'transcript' ? transcriptionAlerts : translationAlerts
  const definition = alerts.find((a) => a.id === alertId)
  if (!definition) {
    throw new Error(`Alert definition not found: ${alertId}`)
  }
  return {
    id: definition.id,
    type: definition.type,
    message: definition.messageTemplate(computedValues),
    computedValues,
  }
}

// Mock alerts using actual alert definitions
const mockErrorAlert = createMockAlert('reached-limit', {})

const mockNearLimitAlert = createMockAlert('near-limit', { remainingMinutes: 5 })

const mockWarningAlreadyTranscribed = createMockAlert('already-transcribed', { count: 3, minutes: 15 })

const mockWarningNoSource = createMockAlert('no-source', { count: 2 })

const mockWarningConflicting = createMockAlert('conflicting-job', {})

const mockErrorNoEligible = createMockAlert('no-eligible-submissions', { totalCount: 5, filteredCount: 5 })

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
