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
  // Keep the count even with no neighbour left, so the ends of the list still place the record.
  return { submission: data.data.results[0], count: data.data.count }
}

export interface SubmissionNeighbors {
  isLoading: boolean
  /** Root UUID of the record to move to, absent at either end of the list. */
  prevRootUuid?: string
  nextRootUuid?: string
  /**
   * 1-based position of the current record, and how many there are in total.
   * Both are absent until the counts are in.
   */
  index?: number
  total?: number
}

/**
 * The records either side of the given one, and where it sits among them,
 * following the data table's filters for as long as they are remembered (see
 * `tableViewState`).
 *
 * Rather than working from a list, this asks the API for the single record on
 * each side plus how many lie that way, so it works the same whether the user
 * arrived from the data table, from the map, or from a link someone sent them.
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

  // Submissions are listed newest first, so everything "before" the current
  // record is newer than it.
  const newerCount = queryPrev.data?.count ?? 0
  const olderCount = queryNext.data?.count ?? 0

  // Both sides are needed to place the record, and a query at the end of the
  // list succeeds with no neighbour - hence `isSuccess` rather than `data`.
  const hasCounts = queryPrev.isSuccess && queryNext.isSuccess

  return {
    isLoading: isEnabled && (queryPrev.isPending || queryNext.isPending),
    prevRootUuid: queryPrev.data?.submission && getSubmissionRootUuid(queryPrev.data.submission),
    nextRootUuid: queryNext.data?.submission && getSubmissionRootUuid(queryNext.data.submission),
    index: hasCounts ? newerCount + 1 : undefined,
    total: hasCounts ? newerCount + olderCount + 1 : undefined,
  }
}
