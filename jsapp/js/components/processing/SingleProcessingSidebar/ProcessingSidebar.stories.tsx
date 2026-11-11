import type { Decorator, Meta, StoryObj } from '@storybook/react-webpack5'
import { generatePath } from 'react-router-dom'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import { getAssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content/msw'
import { QuestionTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import assetDataFactory from '#/endpoints/assetData.factory'
import { queryClientDecorator } from '#/query/queryClient.mocks'
import { PROCESSING_ROUTES } from '#/router/routerConstants'
import ProcessingSidebar from './index'

const XPATH = 'Record_a_sound'

const asset = getAssetsRetrieveResponseMock({
  uid: 'processing-sidebar-asset',
  name: 'Audio form',
  summary: { languages: [] },
  content: {
    schema: '1',
    survey: [
      { type: QuestionTypeName.text, $kuid: 'nam1', label: ['Your name'], $xpath: 'Your_name', $autoname: 'Your_name' },
      { type: QuestionTypeName.integer, $kuid: 'age1', label: ['Your age'], $xpath: 'Your_age', $autoname: 'Your_age' },
      { type: QuestionTypeName.audio, $kuid: 'snd1', label: ['Record a sound'], $xpath: XPATH, $autoname: XPATH },
      {
        type: QuestionTypeName.date,
        $kuid: 'dat1',
        label: ['Visit date'],
        $xpath: 'Visit_date',
        $autoname: 'Visit_date',
      },
    ],
    settings: {},
    translated: ['label'],
    translations: [null],
  },
}) as unknown as AssetResponse

const SILENT_WAV = 'data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA=='

function buildSubmission(mimetype: string) {
  return assetDataFactory(1, {
    Your_name: 'Ada',
    Your_age: '36',
    [XPATH]: 'recording.wav',
    Visit_date: '2026-11-10',
    _attachments: [
      {
        uid: 'att1',
        question_xpath: XPATH,
        mimetype,
        download_url: SILENT_WAV,
        filename: 'user/attachments/recording.wav',
        media_file_basename: 'recording.wav',
        is_deleted: false,
      },
    ],
  }) as unknown as DataResponse
}

// The sidebar reads the active tab from the URL hash.
const transcriptRouteDecorator: Decorator = (Story) => {
  window.location.hash = generatePath(PROCESSING_ROUTES.TRANSCRIPT, {
    uid: asset.uid,
    xpath: XPATH,
    submissionEditId: 'mock-uuid-1',
  })
  return Story()
}

const meta: Meta<typeof ProcessingSidebar> = {
  title: 'Components/ProcessingSidebar',
  component: ProcessingSidebar,
  decorators: [queryClientDecorator, transcriptRouteDecorator],
  parameters: { a11y: { disable: true } },
  args: {
    asset,
    questionXpath: XPATH,
    questionLabelLanguage: '',
    supplement: {} as DataSupplementResponse,
  },
}

export default meta

type Story = StoryObj<typeof ProcessingSidebar>

export const AudioQuestion: Story = {
  args: { submission: buildSubmission('audio/wav') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('recording.wav')).toBeVisible()
    await expect(canvas.getByText('Ada')).toBeVisible()
  },
}

export const DisplaySettingsModal: Story = {
  args: { submission: buildSubmission('audio/wav') },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Display settings' }))

    // The modal renders outside the story canvas.
    const dialog = await within(document.body).findByRole('dialog', { name: 'Customize display settings' })
    // Wait out the opening transition, so the snapshot shows the settled modal.
    await waitFor(() => expect(within(dialog).getByText('Your name')).toBeVisible())
  },
}

/** Some clients (e.g. mockobo) send files without a mimetype. */
export const AudioQuestionWithoutMimetype: Story = {
  args: { submission: buildSubmission('') },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('recording.wav')).toBeVisible()
  },
}
