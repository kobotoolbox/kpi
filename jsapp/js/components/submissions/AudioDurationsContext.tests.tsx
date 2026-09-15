import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { assetsAttachmentsAudioDurationCreate } from '#/api/react-query/survey-data'
import type { SubmissionResponse } from '#/dataInterface'
import { AudioDurationsProvider, useAttachmentDuration } from './AudioDurationsContext'
import { buildSubmissionWithAttachments, mockAudioDurationResponse } from './useCalculateAudioDuration.mocks'

jest.mock('#/api/react-query/survey-data', () => {
  return {
    assetsAttachmentsAudioDurationCreate: jest.fn(),
  }
})

jest.mock('#/envStore', () => {
  return {
    __esModule: true,
    default: {
      data: {
        asr_mt_features_enabled: true,
      },
    },
  }
})

const createMock = assetsAttachmentsAudioDurationCreate as jest.MockedFunction<
  typeof assetsAttachmentsAudioDurationCreate
>
const envStore = require('#/envStore').default as { data: { asr_mt_features_enabled: boolean } }

/**
 * Renders `useAttachmentDuration` inside the provider so we exercise the whole
 * pipeline: attachment filtering -> batched fetch -> context lookup.
 */
function renderProviderHook(options: {
  submissions: SubmissionResponse[]
  visibleAudioXpaths: string[]
  attachmentUid: string
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderHook(() => useAttachmentDuration(options.attachmentUid), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AudioDurationsProvider
          assetUid='asset-1'
          submissions={options.submissions}
          visibleAudioXpaths={options.visibleAudioXpaths}
        >
          {children}
        </AudioDurationsProvider>
      </QueryClientProvider>
    ),
  })
}

describe('AudioDurationsProvider', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    envStore.data.asr_mt_features_enabled = true
  })

  it('fetches and exposes the backend duration for a visible audio attachment', async () => {
    createMock.mockResolvedValue(mockAudioDurationResponse({ attachments: [{ uid: 'a', seconds: 8 }], total: 8 }))

    const { result } = renderProviderHook({
      submissions: [buildSubmissionWithAttachments([{ uid: 'a', question_xpath: 'audio_q' }])],
      visibleAudioXpaths: ['audio_q'],
      attachmentUid: 'a',
    })

    await waitFor(() => chai.expect(result.current).to.equal(8))
    chai.expect(createMock.mock.calls[0][1].attachment_uids).to.deep.equal(['a'])
  })

  it('does not fetch when ASR/MT features are disabled', () => {
    envStore.data.asr_mt_features_enabled = false

    const { result } = renderProviderHook({
      submissions: [buildSubmissionWithAttachments([{ uid: 'a', question_xpath: 'audio_q' }])],
      visibleAudioXpaths: ['audio_q'],
      attachmentUid: 'a',
    })

    chai.expect(createMock.mock.calls.length).to.equal(0)
    // Falls back to undefined so the player uses the browser-decoded duration.
    chai.expect(result.current).to.equal(undefined)
  })

  it('skips attachments whose column is not visible', async () => {
    createMock.mockResolvedValue(mockAudioDurationResponse({ attachments: [{ uid: 'visible', seconds: 5 }], total: 5 }))

    renderProviderHook({
      submissions: [
        buildSubmissionWithAttachments([
          { uid: 'visible', question_xpath: 'audio_q' },
          { uid: 'hidden', question_xpath: 'other_audio_q' },
        ]),
      ],
      // Only `audio_q` is shown, so `other_audio_q`'s attachment is excluded.
      visibleAudioXpaths: ['audio_q'],
      attachmentUid: 'visible',
    })

    await waitFor(() => chai.expect(createMock.mock.calls.length).to.equal(1))
    chai.expect(createMock.mock.calls[0][1].attachment_uids).to.deep.equal(['visible'])
  })

  it('skips deleted and non-audio attachments', async () => {
    createMock.mockResolvedValue(mockAudioDurationResponse({ attachments: [{ uid: 'audio', seconds: 3 }], total: 3 }))

    renderProviderHook({
      submissions: [
        buildSubmissionWithAttachments([
          { uid: 'audio', question_xpath: 'audio_q' },
          { uid: 'deleted', question_xpath: 'audio_q', is_deleted: true },
          { uid: 'image', question_xpath: 'audio_q', mimetype: 'image/jpeg' },
        ]),
      ],
      visibleAudioXpaths: ['audio_q'],
      attachmentUid: 'audio',
    })

    await waitFor(() => chai.expect(createMock.mock.calls.length).to.equal(1))
    chai.expect(createMock.mock.calls[0][1].attachment_uids).to.deep.equal(['audio'])
  })

  it('does not fetch when there are no visible audio columns', () => {
    renderProviderHook({
      submissions: [buildSubmissionWithAttachments([{ uid: 'a', question_xpath: 'audio_q' }])],
      visibleAudioXpaths: [],
      attachmentUid: 'a',
    })

    chai.expect(createMock.mock.calls.length).to.equal(0)
  })
})

describe('useAttachmentDuration', () => {
  it('returns undefined outside of a provider', () => {
    const { result } = renderHook(() => useAttachmentDuration('a'))
    chai.expect(result.current).to.equal(undefined)
  })
})
