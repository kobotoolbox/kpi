import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { expect, within } from 'storybook/test'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import { getAssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content/msw'
import {
  getAssetsAttachmentsAudioDurationCreateMockHandler,
  getAssetsDataSupplementRetrieveMockHandler,
} from '#/api/react-query/survey-data/msw'
import type { AssetResponse } from '#/dataInterface'
import assetDataFactory from '#/endpoints/assetData.factory'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import TranscriptPoll from './TranscriptPoll'
import { buildAutomaticTranscriptSupplement, buildAutomaticTranscriptVersion } from './transcript.mocks'

const XPATH = 'Record_a_sound'
// Two hours of audio. Transcribing it is estimated at 449 s, shown as "about 8 minutes".
const TWO_HOURS = 7200

const asset = getAssetsRetrieveResponseMock({ uid: 'transcript-poll-asset' }) as unknown as AssetResponse

const submission = assetDataFactory(1, {
  [XPATH]: 'recording.wav',
  _attachments: [
    {
      uid: 'att1',
      question_xpath: XPATH,
      mimetype: 'audio/wav',
      download_url: '',
      filename: 'user/attachments/recording.wav',
      media_file_basename: 'recording.wav',
      is_deleted: false,
    },
  ],
}) as unknown as DataResponse

/** A transcript started at 10:00:00 that the backend last moved at `dateModified`. */
function buildSupplement(dateModified: string) {
  return buildAutomaticTranscriptSupplement(XPATH, dateModified, [
    buildAutomaticTranscriptVersion('2026-01-01T10:00:00Z'),
  ])
}

function buildHandlers(supplement: DataSupplementResponse) {
  return [
    getAssetsAttachmentsAudioDurationCreateMockHandler({
      attachments: [{ uid: 'att1', seconds: TWO_HOURS }],
      total: TWO_HOURS,
    }),
    // Polling refetches keep returning the same state.
    getAssetsDataSupplementRetrieveMockHandler(supplement),
  ]
}

const meta: Meta<typeof TranscriptPoll> = {
  title: 'Components/Processing_TranscriptPoll',
  component: TranscriptPoll,
  tags: ['!autodocs'],
  decorators: [queryClientDecorator],
  args: { asset, questionXpath: XPATH, submission, activeBulkActions: [] },
}

export default meta

type Story = StoryObj<typeof TranscriptPoll>

const midwaySupplement = buildSupplement('2026-01-01T10:05:00Z')
export const Midway: Story = {
  args: { supplement: midwaySupplement },
  parameters: { msw: { handlers: buildHandlers(midwaySupplement) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('66% complete')).toBeVisible()
    await expect(canvas.getByText('Estimated time for completion: about 8 minutes')).toBeVisible()
  },
}

const overdueSupplement = buildSupplement('2026-01-01T10:08:00Z')
export const TakingLongerThanExpected: Story = {
  args: { supplement: overdueSupplement },
  parameters: { msw: { handlers: buildHandlers(overdueSupplement) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('This is taking longer than expected.')).toBeVisible()
    await expect(canvas.queryByText(/% complete/)).toBeNull()
  },
}
