import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { assetsAttachmentsAudioDurationCreate } from '#/api/react-query/survey-data'
import { useAudioDurations, useCalculateAudioDuration } from './useCalculateAudioDuration.hook'
import { buildSubmissionWithAttachments, mockAudioDurationResponse } from './useCalculateAudioDuration.mocks'

jest.mock('#/api/react-query/survey-data', () => {
  return {
    assetsAttachmentsAudioDurationCreate: jest.fn(),
  }
})

const createMock = assetsAttachmentsAudioDurationCreate as jest.MockedFunction<
  typeof assetsAttachmentsAudioDurationCreate
>

/** Builds a QueryClient wrapper with retries off so failures surface immediately. */
function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useAudioDurations', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns an empty result without calling the API when there are no attachments', () => {
    const { result } = renderHook(() => useAudioDurations([], 'asset-1'), { wrapper: buildWrapper() })

    chai.expect(createMock.mock.calls.length).to.equal(0)
    chai.expect(result.current.isLoading).to.equal(false)
    chai.expect(result.current.duration).to.equal(0)
    chai.expect(result.current.durationsByUid.size).to.equal(0)
  })

  it('maps each attachment uid to its backend seconds and exposes the total', async () => {
    createMock.mockResolvedValue(
      mockAudioDurationResponse({
        attachments: [
          { uid: 'a', seconds: 8 },
          { uid: 'b', seconds: 9 },
        ],
        total: 17,
      }),
    )

    const { result } = renderHook(() => useAudioDurations(['a', 'b'], 'asset-1'), { wrapper: buildWrapper() })

    await waitFor(() => chai.expect(result.current.isLoading).to.equal(false))

    chai.expect(result.current.duration).to.equal(17)
    chai.expect(result.current.durationsByUid.get('a')).to.equal(8)
    chai.expect(result.current.durationsByUid.get('b')).to.equal(9)
  })

  it('preserves null seconds in the map (e.g. duration could not be determined)', async () => {
    createMock.mockResolvedValue(
      mockAudioDurationResponse({
        attachments: [
          { uid: 'a', seconds: 5 },
          { uid: 'b', seconds: null },
        ],
        total: 5,
      }),
    )

    const { result } = renderHook(() => useAudioDurations(['a', 'b'], 'asset-1'), { wrapper: buildWrapper() })

    await waitFor(() => chai.expect(result.current.isLoading).to.equal(false))

    chai.expect(result.current.durationsByUid.get('a')).to.equal(5)
    chai.expect(result.current.durationsByUid.get('b')).to.equal(null)
    chai.expect(result.current.duration).to.equal(5)
  })

  it('splits more than 50 attachments into batches and sums their totals', async () => {
    const uids = Array.from({ length: 120 }, (_, i) => `uid-${i}`)
    createMock.mockImplementation(async (_assetUid, request) => {
      const batch = request.attachment_uids
      return mockAudioDurationResponse({
        attachments: batch.map((uid) => {
          return { uid, seconds: 1 }
        }),
        total: batch.length,
      })
    })

    const { result } = renderHook(() => useAudioDurations(uids, 'asset-1'), { wrapper: buildWrapper() })

    await waitFor(() => chai.expect(result.current.isLoading).to.equal(false))

    // 120 uids -> batches of 50, 50, 20
    chai.expect(createMock.mock.calls.length).to.equal(3)
    chai.expect(createMock.mock.calls[0][1].attachment_uids).to.have.length(50)
    chai.expect(createMock.mock.calls[2][1].attachment_uids).to.have.length(20)
    chai.expect(result.current.duration).to.equal(120)
    chai.expect(result.current.durationsByUid.size).to.equal(120)
  })

  it('reports an error and empties the results when the request fails', async () => {
    createMock.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useAudioDurations(['a'], 'asset-1'), { wrapper: buildWrapper() })

    await waitFor(() => chai.expect(result.current.isError).to.equal(true))

    chai.expect(result.current.duration).to.equal(0)
    chai.expect(result.current.durationsByUid.size).to.equal(0)
    chai.expect(result.current.errorMessage).to.be.a('string')
  })
})

describe('useCalculateAudioDuration', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('only requests durations for attachments matching the given field', async () => {
    createMock.mockResolvedValue(
      mockAudioDurationResponse({
        attachments: [{ uid: 'match', seconds: 12 }],
        total: 12,
      }),
    )

    const submissions = [
      buildSubmissionWithAttachments([
        { uid: 'match', question_xpath: 'audio_q' },
        { uid: 'other', question_xpath: 'another_q' },
      ]),
    ]

    const { result } = renderHook(
      () => useCalculateAudioDuration({ selectedSubmissions: submissions, fieldId: 'audio_q', assetUid: 'asset-1' }),
      { wrapper: buildWrapper() },
    )

    await waitFor(() => chai.expect(result.current.isLoading).to.equal(false))

    chai.expect(createMock.mock.calls.length).to.equal(1)
    chai.expect(createMock.mock.calls[0][1].attachment_uids).to.deep.equal(['match'])
    chai.expect(result.current.duration).to.equal(12)
  })
})
