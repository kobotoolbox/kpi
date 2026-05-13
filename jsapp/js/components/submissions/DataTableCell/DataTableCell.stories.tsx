import { Box } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { CellInfo } from 'react-table'
import { SUPPLEMENTAL_DETAILS_PROP } from '#/constants'
import type { SubmissionResponse } from '#/dataInterface'
import {
  simpleSurvey,
  simpleSurveyAsset,
  simpleSurveyChoices,
  simpleSurveySubmission,
  simpleSurveySubmissionEmpty,
} from '../submissionUtils.mocks'
import DataTableCell from './index'

const transcriptColumnKey = `${SUPPLEMENTAL_DETAILS_PROP}/Secret_password_as_an_audio_file/transcript_fr`

function buildReactTableRow(submission: SubmissionResponse, value: unknown, index = 0): CellInfo {
  return {
    original: submission,
    value,
    index,
  } as CellInfo
}

const supplementalSubmission = {
  ...simpleSurveySubmission,
  [SUPPLEMENTAL_DETAILS_PROP]: {
    Secret_password_as_an_audio_file: {
      transcript: {
        languageCode: 'fr',
        value: 'This is french transcript text.',
      },
    },
  },
} as SubmissionResponse

const meta: Meta<typeof DataTableCell> = {
  title: 'Components/Submissions/DataTableCell',
  component: DataTableCell,
  decorators: [
    (Story) => (
      <Box maw={380} p='md'>
        <Story />
      </Box>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof DataTableCell>

export const PlainText: Story = {
  args: {
    asset: simpleSurveyAsset,
    reactTableRow: buildReactTableRow(simpleSurveySubmission, 'Leszek'),
    columnKey: 'First_name',
    question: simpleSurvey[2],
    choices: simpleSurveyChoices as unknown as [],
    showGroupName: false,
    translationIndex: 0,
    submissionCount: 2,
  },
}

export const SupplementalTranscript: Story = {
  args: {
    asset: simpleSurveyAsset,
    reactTableRow: buildReactTableRow(supplementalSubmission, undefined),
    columnKey: transcriptColumnKey,
    question: undefined,
    choices: simpleSurveyChoices as unknown as [],
    showGroupName: false,
    translationIndex: 0,
    submissionCount: 2,
  },
}

export const BulkProcessingInProgress: Story = {
  args: {
    asset: simpleSurveyAsset,
    reactTableRow: buildReactTableRow(simpleSurveySubmissionEmpty, undefined),
    columnKey: transcriptColumnKey,
    question: undefined,
    choices: simpleSurveyChoices as unknown as [],
    showGroupName: false,
    translationIndex: 0,
    submissionCount: 2,
    isBulkProcessingInProgress: true,
  },
}
