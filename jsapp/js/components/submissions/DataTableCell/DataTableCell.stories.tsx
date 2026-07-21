import { Box } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CellInfo } from 'react-table'
import { QuestionTypeName, SUPPLEMENTAL_DETAILS_PROP } from '#/constants'
import type { SubmissionResponse } from '#/dataInterface'
import assetDataFactory from '#/endpoints/assetData.factory'
import { KOBO_MODAL_SHARED_PROPS } from '#/theme/kobo/Modal'
import {
  simpleSurvey,
  simpleSurveyAsset,
  simpleSurveyChoices,
  simpleSurveySubmission,
  simpleSurveySubmissionEmpty,
} from '../submissionUtils.mocks'
import DataTableCell from './index'

const transcriptColumnKey = `${SUPPLEMENTAL_DETAILS_PROP}/What_is_your_opinion/transcript_fr`

// Offline-safe media payloads for stories. They avoid network requests so
// Chromatic remains deterministic.
const TINY_IMAGE_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Crect width='12' height='12' fill='%2300A3E0'/%3E%3C/svg%3E"
const TINY_AUDIO_DATA_URI = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='
const TINY_VIDEO_DATA_URI = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb20='

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
      transcript: {
        languageCode: 'fr',
        pendingReview: true,
        regionCode: null,
      },
    },
  },
})

const missingAttachmentQuestion = {
  type: QuestionTypeName.image,
  $kuid: 'missingImageQuestion',
  $autoname: 'Missing_photo',
  $xpath: 'Missing_photo',
  label: ['Missing photo'],
} as const

const missingAttachmentSubmission = {
  ...simpleSurveySubmission,
  Missing_photo: 'missing-photo.jpg',
  _attachments: [],
} as SubmissionResponse

const imageQuestion = {
  type: QuestionTypeName.image,
  $kuid: 'imageQuestion',
  $autoname: 'Photo_question',
  $xpath: 'Photo_question',
  label: ['Photo question'],
} as const

const audioQuestion = {
  type: QuestionTypeName.audio,
  $kuid: 'audioQuestion',
  $autoname: 'Audio_question',
  $xpath: 'Audio_question',
  label: ['Audio question'],
} as const

const videoQuestion = {
  type: QuestionTypeName.video,
  $kuid: 'videoQuestion',
  $autoname: 'Video_question',
  $xpath: 'Video_question',
  label: ['Video question'],
} as const

const imageSubmission = {
  ...simpleSurveySubmission,
  Photo_question: 'tiny-image.svg',
  _attachments: [
    {
      download_url: TINY_IMAGE_DATA_URI,
      download_medium_url: TINY_IMAGE_DATA_URI,
      download_small_url: TINY_IMAGE_DATA_URI,
      download_large_url: TINY_IMAGE_DATA_URI,
      mimetype: 'image/svg+xml',
      filename: 'attachments/tiny-image.svg',
      media_file_basename: 'tiny-image.svg',
      question_xpath: 'Photo_question',
      uid: 'attachment-image-1',
      is_deleted: false,
    },
  ],
} as SubmissionResponse

const audioSubmission = {
  ...simpleSurveySubmission,
  Audio_question: 'tiny-audio.wav',
  _attachments: [
    {
      download_url: TINY_AUDIO_DATA_URI,
      download_medium_url: TINY_AUDIO_DATA_URI,
      download_small_url: TINY_AUDIO_DATA_URI,
      download_large_url: TINY_AUDIO_DATA_URI,
      mimetype: 'audio/wav',
      filename: 'attachments/tiny-audio.wav',
      media_file_basename: 'tiny-audio.wav',
      question_xpath: 'Audio_question',
      uid: 'attachment-audio-1',
      is_deleted: false,
    },
  ],
} as SubmissionResponse

const videoSubmission = {
  ...simpleSurveySubmission,
  Video_question: 'tiny-video.mp4',
  _attachments: [
    {
      download_url: TINY_VIDEO_DATA_URI,
      download_medium_url: TINY_VIDEO_DATA_URI,
      download_small_url: TINY_VIDEO_DATA_URI,
      download_large_url: TINY_VIDEO_DATA_URI,
      mimetype: 'video/mp4',
      filename: 'attachments/tiny-video.mp4',
      media_file_basename: 'tiny-video.mp4',
      question_xpath: 'Video_question',
      uid: 'attachment-video-1',
      is_deleted: false,
    },
  ],
} as SubmissionResponse

const meta: Meta<typeof DataTableCell> = {
  title: 'Components/DataTableCell',
  component: DataTableCell,
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 0,
            refetchOnWindowFocus: false,
          },
        },
      })

      return (
        <QueryClientProvider client={queryClient}>
          <ModalsProvider modalProps={KOBO_MODAL_SHARED_PROPS}>
            <Box maw={250} p='md'>
              <Story />
            </Box>
          </ModalsProvider>
        </QueryClientProvider>
      )
    },
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
  parameters: {
    docs: {
      description: {
        story: 'Modal opens via Mantine modals; this story is wrapped in ModalsProvider so the expand button works.',
      },
    },
  },
}

export const AttachmentMissing: Story = {
  args: {
    asset: simpleSurveyAsset,
    reactTableRow: buildReactTableRow(missingAttachmentSubmission, missingAttachmentSubmission.Missing_photo),
    columnKey: 'Missing_photo',
    question: missingAttachmentQuestion as never,
    choices: simpleSurveyChoices as unknown as [],
    showGroupName: false,
    translationIndex: 0,
    submissionCount: 2,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Attachment exists in submission data but attachment payload is missing, so the cell safely falls back to raw filename text and does not open a media modal.',
      },
    },
  },
}

export const ImageAttachment: Story = {
  args: {
    asset: simpleSurveyAsset,
    reactTableRow: buildReactTableRow(imageSubmission, imageSubmission.Photo_question),
    columnKey: 'Photo_question',
    question: imageQuestion as never,
    choices: simpleSurveyChoices as unknown as [],
    showGroupName: false,
    translationIndex: 0,
    submissionCount: 2,
  },
}

export const AudioAttachment: Story = {
  args: {
    asset: simpleSurveyAsset,
    reactTableRow: buildReactTableRow(audioSubmission, audioSubmission.Audio_question),
    columnKey: 'Audio_question',
    question: audioQuestion as never,
    choices: simpleSurveyChoices as unknown as [],
    showGroupName: false,
    translationIndex: 0,
    submissionCount: 2,
  },
}

export const VideoAttachment: Story = {
  args: {
    asset: simpleSurveyAsset,
    reactTableRow: buildReactTableRow(videoSubmission, videoSubmission.Video_question),
    columnKey: 'Video_question',
    question: videoQuestion as never,
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
