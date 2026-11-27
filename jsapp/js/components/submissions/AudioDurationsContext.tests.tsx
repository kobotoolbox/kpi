import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { assetsAttachmentsAudioDurationCreate } from '#/api/react-query/survey-data'
import type { SubmissionResponse } from '#/dataInterface'
import { AudioDurationsProvider, useAttachmentDuration } from './AudioDurationsContext'
import type { VisibleAudioXpaths } from './table.types'
import { buildSubmissionWithAttachments, mockAudioDurationResponse } from './useCalculateAudioDuration.mocks'

jest.mock('#/api/react-query/survey-data', () => {
  return {
    assetsAttachmentsAudioDurationCreate: jest.fn(),
  }
})

const createMock = assetsAttachmentsAudioDurationCreate as jest.MockedFunction<
  typeof assetsAttachmentsAudioDurationCreate
>

/**
 * Renders `useAttachmentDuration` inside the provider so we exercise the whole
 * pipeline: attachment filtering -> batched fetch -> context lookup.
 */
function renderProviderHook(options: {
  submissions: SubmissionResponse[]
  visibleAudioXpaths: Partial<VisibleAudioXpaths>
  attachmentUid: string
}) {
  const visibleAudioXpaths = { audioQuestion: [], noQuestion: [], ...options.visibleAudioXpaths }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderHook(() => useAttachmentDuration(options.attachmentUid), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AudioDurationsProvider
          assetUid='asset-1'
          submissions={options.submissions}
          visibleAudioXpaths={visibleAudioXpaths}
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
  })

  // ASR/MT is off here (envStore default), so this proves durations load without it.
  it('fetches and exposes the backend duration for a visible audio attachment', async () => {
    createMock.mockResolvedValue(mockAudioDurationResponse({ attachments: [{ uid: 'a', seconds: 8 }], total: 8 }))

    const { result } = renderProviderHook({
      submissions: [buildSubmissionWithAttachments([{ uid: 'a', question_xpath: 'audio_q' }])],
      visibleAudioXpaths: { audioQuestion: ['audio_q'] },
      attachmentUid: 'a',
    })

    await waitFor(() => chai.expect(result.current).to.equal(8))
    chai.expect(createMock.mock.calls[0][1].attachment_uids).to.deep.equal(['a'])
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
      visibleAudioXpaths: { audioQuestion: ['audio_q'] },
      attachmentUid: 'visible',
    })

    await waitFor(() => chai.expect(createMock.mock.calls.length).to.equal(1))
    chai.expect(createMock.mock.calls[0][1].attachment_uids).to.deep.equal(['visible'])
  })

  it('skips deleted attachments', async () => {
    createMock.mockResolvedValue(mockAudioDurationResponse({ attachments: [{ uid: 'audio', seconds: 3 }], total: 3 }))

    renderProviderHook({
      submissions: [
        buildSubmissionWithAttachments([
          { uid: 'audio', question_xpath: 'audio_q' },
          { uid: 'deleted', question_xpath: 'audio_q', is_deleted: true },
        ]),
      ],
      visibleAudioXpaths: { audioQuestion: ['audio_q'] },
      attachmentUid: 'audio',
    })

    await waitFor(() => chai.expect(createMock.mock.calls.length).to.equal(1))
    chai.expect(createMock.mock.calls[0][1].attachment_uids).to.deep.equal(['audio'])
  })

  // The cell plays these by question type, so the mimetype doesn't matter.
  it("fetches an audio question's file even when it has no mimetype", async () => {
    createMock.mockResolvedValue(mockAudioDurationResponse({ attachments: [{ uid: 'untyped', seconds: 4 }], total: 4 }))

    const { result } = renderProviderHook({
      submissions: [buildSubmissionWithAttachments([{ uid: 'untyped', question_xpath: 'audio_q', mimetype: '' }])],
      visibleAudioXpaths: { audioQuestion: ['audio_q'] },
      attachmentUid: 'untyped',
    })

    await waitFor(() => chai.expect(result.current).to.equal(4))
    chai.expect(createMock.mock.calls[0][1].attachment_uids).to.deep.equal(['untyped'])
  })

  // With no question, the cell guesses the type from the mimetype.
  it('fetches only audio mimetypes from a column with no question', async () => {
    createMock.mockResolvedValue(mockAudioDurationResponse({ attachments: [], total: 0 }))

    renderProviderHook({
      submissions: [
        buildSubmissionWithAttachments([
          { uid: 'mp3', question_xpath: 'old_q' },
          { uid: 'ogg', question_xpath: 'old_q', mimetype: 'application/ogg' },
          { uid: 'untyped', question_xpath: 'old_q', mimetype: '' },
          { uid: 'image', question_xpath: 'old_q', mimetype: 'image/jpeg' },
        ]),
      ],
      visibleAudioXpaths: { noQuestion: ['old_q'] },
      attachmentUid: 'mp3',
    })

    await waitFor(() => chai.expect(createMock.mock.calls.length).to.equal(1))
    chai.expect(createMock.mock.calls[0][1].attachment_uids).to.deep.equal(['mp3', 'ogg'])
  })

  it('does not fetch when there are no visible audio columns', () => {
    renderProviderHook({
      submissions: [buildSubmissionWithAttachments([{ uid: 'a', question_xpath: 'audio_q' }])],
      visibleAudioXpaths: {},
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
