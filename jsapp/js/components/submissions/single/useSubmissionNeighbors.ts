import type { PaginatedDataResponseListCount } from '#/api/models/paginatedDataResponseListCount'
import {
  type assetsDataListResponse,
  getAssetsDataListQueryKey,
  useAssetsDataList,
} from '#/api/react-query/survey-data'
import { getSubmissionRootUuid } from '#/utils'
import type { SubmissionListPosition } from './submissionRouting'
import { getSubmissionListNeighborParams, getSubmissionNeighborParams } from './submissionRouting'

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
   * 1-based position of the current record. Absent until the counts are in, and
   * when the API stopped counting before reaching the record.
   */
  index?: number
  /** How many records there are, which the API may only know as 'many' or 'unknown'. */
  total?: PaginatedDataResponseListCount
}

/**
 * The records either side of the given one, and where it sits among them.
 *
 * Rather than working from a list, this asks the API for the single record on
 * each side, so it works the same whether the record is shown over the data table
 * or at its own address with no table at all.
 *
 * @param submissionId - `_id` of the record being displayed. Leave it out while
 * the record is still loading, and nothing will be fetched.
 * @param listPosition - The record's place in the data table, to step through the
 * table's rows. Without it, this walks every submission the user can see, newest first.
 */
export function useSubmissionNeighbors(
  assetUid: string,
  submissionId?: number,
  listPosition?: SubmissionListPosition,
): SubmissionNeighbors {
  const isEnabled = submissionId !== undefined

  // The params are still built when disabled, so that each record keeps its own
  // query key - the id is ignored until the query runs.
  const prevParams = listPosition
    ? getSubmissionListNeighborParams(listPosition, 'prev')
    : getSubmissionNeighborParams(submissionId ?? 0, 'prev')
  const queryPrev = useAssetsDataList(assetUid, prevParams, {
    query: {
      queryKey: getAssetsDataListQueryKey(assetUid, prevParams),
      select: selectNeighbor,
      // The first row of the table has nothing before it.
      enabled: isEnabled && (listPosition === undefined || listPosition.index > 0),
    },
  })

  const nextParams = listPosition
    ? getSubmissionListNeighborParams(listPosition, 'next')
    : getSubmissionNeighborParams(submissionId ?? 0, 'next')
  const queryNext = useAssetsDataList(assetUid, nextParams, {
    query: { queryKey: getAssetsDataListQueryKey(assetUid, nextParams), select: selectNeighbor, enabled: isEnabled },
  })

  const neighbors = {
    // `isLoading` rather than `isPending`, which stays true for a query that never runs.
    isLoading: queryPrev.isLoading || queryNext.isLoading,
    prevRootUuid: queryPrev.data?.submission && getSubmissionRootUuid(queryPrev.data.submission),
    nextRootUuid: queryNext.data?.submission && getSubmissionRootUuid(queryNext.data.submission),
  }

  if (listPosition) {
    // Both sides query the whole filtered list, so either one's count is the table's total.
    const total = queryNext.data?.count
    return { ...neighbors, index: total === undefined ? undefined : listPosition.index + 1, total }
  }

  // Submissions are listed newest first, so everything "before" the current
  // record is newer than it.
  const newerCount = queryPrev.data?.count
  const olderCount = queryNext.data?.count

  // Past the count limit there is no telling where the record sits.
  if (typeof newerCount !== 'number' || olderCount === undefined) {
    return neighbors
  }

  return {
    ...neighbors,
    index: newerCount + 1,
    // A capped count on the far side caps the total too.
    total: typeof olderCount === 'number' ? newerCount + olderCount + 1 : olderCount,
  }
}
