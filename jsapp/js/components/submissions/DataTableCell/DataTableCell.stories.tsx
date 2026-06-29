import { Box } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import type { CellInfo } from 'react-table'
import { SUPPLEMENTAL_DETAILS_PROP } from '#/constants'
import type { SubmissionResponse } from '#/dataInterface'
import assetDataFactory from '#/endpoints/assetData.factory'
import {
  simpleSurvey,
  simpleSurveyAsset,
  simpleSurveyChoices,
  simpleSurveySubmission,
  simpleSurveySubmissionEmpty,
} from '../submissionUtils.mocks'
import DataTableCell from './index'

const transcriptColumnKey = `${SUPPLEMENTAL_DETAILS_PROP}/What_is_your_opinion/transcript_fr`

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
    What_is_your_opinion: {
      transcript: {
        languageCode: 'fr',
        value:
          "La collecte de données humanitaires est essentielle pour évaluer les besoins réels des populations touchées par des crises. Les organisations utilisent souvent des outils numériques pour recueillir des informations précises en temps réel sur le terrain. Il est crucial de respecter la protection des données personnelles afin de garantir la sécurité des bénéficiaires vulnérables. Une analyse rigoureuse de ces statistiques permet d'optimiser la distribution de l'aide alimentaire et médicale. Enfin, la collaboration entre les différentes agences internationales renforce l'efficacité de l'intervention humanitaire globale.",
      },
    },
  },
} as SubmissionResponse

// Submission with unaccepted automatic transcript - shows Review button
const unacceptedTranscriptSubmission = assetDataFactory(1, {
  [SUPPLEMENTAL_DETAILS_PROP]: {
    What_is_your_opinion: {
      automatic_google_transcription: {
        _versions: [
          {
            _uuid: 'version-uuid-1',
            _dateCreated: '2024-01-15T10:30:00Z',
            _dateAccepted: undefined, // Not accepted - triggers Review button
            _data: {
              language: 'fr',
              value: 'Ceci est une transcription automatique générée par Google.',
              status: 'complete',
            },
          },
        ],
      },
    },
  } as any, // Type assertion needed as automatic_google_transcription isn't in the base interface
})

const meta: Meta<typeof DataTableCell> = {
  title: 'Components/DataTableCell',
  component: DataTableCell,
  decorators: [
    (Story) => (
      <Box maw={250} p='md'>
        <Story />
      </Box>
    ),
  ],
  parameters: {
    a11y: { test: 'todo' },
  },
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

export const UnacceptedAutomaticTranscript: Story = {
  args: {
    asset: simpleSurveyAsset,
    reactTableRow: buildReactTableRow(unacceptedTranscriptSubmission, undefined),
    columnKey: transcriptColumnKey,
    question: undefined,
    choices: simpleSurveyChoices as unknown as [],
    showGroupName: false,
    translationIndex: 0,
    submissionCount: 2,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows a "Review" button when there is unaccepted automatic transcript content',
      },
    },
  },
}
