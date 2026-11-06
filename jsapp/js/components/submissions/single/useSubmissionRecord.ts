import { keepPreviousData, useQueryClient } from '@tanstack/react-query'
import { getAssetsDataListQueryKey, useAssetsDataList } from '#/api/react-query/survey-data'
import type { SubmissionResponse } from '#/dataInterface'
import { getSubmissionLookupParams } from './submissionRouting'

export interface SubmissionRecordState {
  isPending: boolean
  isError: boolean
  /**
   * Absent while loading, on error, and when there is no such record - a link can
   * outlive the record it points at, and the API answers that with an empty list.
   */
  record?: SubmissionResponse
  /** The previous record, standing in while the requested one loads. Nothing should act on it. */
  isPlaceholderData: boolean
  /** Asks for a fresh copy of the record, e.g. after an edit in Enketo. */
  refresh: () => void
}

/**
 * Resolves a root UUID or an `_id` into the one record it names. Shared by the
 * record's route and the preview modal, so the same link lands on the same record
 * in both.
 *
 * @param submissionId - `meta/rootUuid` (preferably) or `_id`
 */
export function useSubmissionRecord(assetUid: string, submissionId: string): SubmissionRecordState {
  const queryClient = useQueryClient()

  const lookupParams = getSubmissionLookupParams(submissionId)
  const queryKey = getAssetsDataListQueryKey(assetUid, lookupParams)
  const query = useAssetsDataList(assetUid, lookupParams, {
    query: {
      queryKey,
      enabled: Boolean(assetUid && submissionId),
      // Keeps the previous record while the next one loads, so stepping doesn't flash a spinner.
      placeholderData: keepPreviousData,
    },
  })

  const result =
    query.data?.status === 200 && query.data.data.results.length > 0 ? query.data.data.results[0] : undefined

  return {
    isPending: query.isPending,
    isError: query.isError,
    isPlaceholderData: query.isPlaceholderData,
    // The submission components are written against `SubmissionResponse`
    record: result as unknown as SubmissionResponse | undefined,
    refresh: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  }
}
