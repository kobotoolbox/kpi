import {
  type assetsDataListResponse,
  getAssetsDataListQueryKey,
  useAssetsDataList,
} from '#/api/react-query/survey-data'
import { getTableViewState } from '#/components/submissions/tableViewState'
import { getSubmissionRootUuid } from '#/utils'
import { getSubmissionNeighborParams } from './submissionRouting'

const selectNeighbor = (data: assetsDataListResponse) => {
  if (data.status !== 200) return
  if (!data.data.results.length) return
  return data.data.results[0]
}

export interface SubmissionNeighbors {
  isLoading: boolean
  /** Root UUID of the record to move to, absent at either end of the list. */
  prevRootUuid?: string
  nextRootUuid?: string
}

/**
 * The records either side of the given one, following the data table's filters
 * for as long as they are remembered (see `tableViewState`).
 *
 * @param submissionId - `_id` of the record being displayed. Leave it out while
 * the record is still loading, and nothing will be fetched.
 */
export function useSubmissionNeighbors(assetUid: string, submissionId?: number): SubmissionNeighbors {
  const isEnabled = submissionId !== undefined

  // Read on each render, but it cannot change while we are here: the table that
  // writes it is unmounted for as long as a record is open.
  const filterQuery = getTableViewState(assetUid)?.filterQuery

  // The params are still built when disabled, so that each record keeps its own
  // query key - the id is ignored until the query runs.
  const prevParams = getSubmissionNeighborParams(submissionId ?? 0, 'prev', filterQuery)
  const queryPrev = useAssetsDataList(assetUid, prevParams, {
    query: { queryKey: getAssetsDataListQueryKey(assetUid, prevParams), select: selectNeighbor, enabled: isEnabled },
  })

  const nextParams = getSubmissionNeighborParams(submissionId ?? 0, 'next', filterQuery)
  const queryNext = useAssetsDataList(assetUid, nextParams, {
    query: { queryKey: getAssetsDataListQueryKey(assetUid, nextParams), select: selectNeighbor, enabled: isEnabled },
  })

  return {
    isLoading: isEnabled && (queryPrev.isPending || queryNext.isPending),
    prevRootUuid: queryPrev.data && getSubmissionRootUuid(queryPrev.data),
    nextRootUuid: queryNext.data && getSubmissionRootUuid(queryNext.data),
  }
}
