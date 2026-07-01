import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { ServerError } from '#/api/ServerError'
import { assetsAttachmentsAudioDurationCreate } from '#/api/react-query/survey-data'
import type { SubmissionResponse } from '#/dataInterface'

interface UseCalculateAudioDurationReturn {
  duration: number
  isLoading: boolean
  isError: boolean
  errorMessage: string | null
}

interface UseCalculateAudioDurationParams {
  selectedSubmissions: SubmissionResponse[]
  fieldId: string
  assetUid: string
}

const MAXIMUM_AUDIO_DURATION_BATCH_SIZE = 50

function is504Error(error: unknown): boolean {
  return (error as ServerError)?.response?.status === 504
}

export function useCalculateAudioDuration({
  selectedSubmissions,
  fieldId,
  assetUid,
}: UseCalculateAudioDurationParams): UseCalculateAudioDurationReturn {
  const batches = useMemo(() => {
    const attachmentUids = selectedSubmissions
      .flatMap((submission) => submission._attachments || [])
      .filter((attachment) => attachment.question_xpath === fieldId)
      .map((attachment) => attachment.uid)

    const result: string[][] = []
    for (let i = 0; i < attachmentUids.length; i += MAXIMUM_AUDIO_DURATION_BATCH_SIZE) {
      result.push(attachmentUids.slice(i, i + MAXIMUM_AUDIO_DURATION_BATCH_SIZE))
    }
    return result
  }, [selectedSubmissions, fieldId])

  return useQueries({
    queries: batches.map((batch) => {
      return {
        queryKey: ['audioDurations', assetUid, batch],
        queryFn: () => assetsAttachmentsAudioDurationCreate(assetUid, { attachment_uids: batch }),
        retry: (failureCount: number, error: unknown) => is504Error(error) && failureCount < 2,
        retryDelay: (attemptIndex: number) => 2 ** attemptIndex * 1000,
      }
    }),
    combine: (results) => {
      const isLoading = results.some((r) => r.isLoading || r.isFetching)
      const isError = results.some((r) => r.isError)
      const firstError = results.find((r) => r.isError)?.error
      return {
        isLoading,
        isError,
        errorMessage: isError
          ? is504Error(firstError)
            ? t('Failed to calculate audio duration after multiple attempts. Please try again.')
            : (firstError as ServerError | undefined)?.toString() ?? t('Failed to calculate audio duration.')
          : null,
        duration: isLoading || isError ? 0 : results.reduce((sum, r) => sum + (r.data?.data.total ?? 0), 0),
      }
    },
  })
}
