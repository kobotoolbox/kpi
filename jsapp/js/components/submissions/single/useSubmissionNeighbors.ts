import { useQueryClient } from '@tanstack/react-query'
import type { PaginatedDataResponseListCount } from '#/api/models/paginatedDataResponseListCount'
import {
  type assetsDataListResponse,
  getAssetsDataListQueryKey,
  useAssetsDataList,
} from '#/api/react-query/survey-data'
import type { SubmissionResponse } from '#/dataInterface'
import { getSubmissionRootUuid } from '#/utils'
import type { SubmissionListPosition } from './submissionRouting'
import { LIST_WINDOW_REACH, getSubmissionListWindowParams, getSubmissionNeighborParams } from './submissionRouting'

const selectNeighbor = (data: assetsDataListResponse) => {
  if (data.status !== 200) return
  // Keep the count even with no neighbour left, so the ends of the list still place the record.
  return { submission: data.data.results[0], count: data.data.count }
}

const selectWindow = (data: assetsDataListResponse) => {
  if (data.status !== 200) return
  // The submission components are written against `SubmissionResponse`
  return { rows: data.data.results as unknown as SubmissionResponse[], count: data.data.count }
}

export interface SubmissionNeighbor {
  rootUuid: string
  /** Its row in the data table, when stepping through the table. */
  listIndex?: number
}

export interface SubmissionNeighbors {
  isLoading: boolean
  /** Absent at either end of the list. */
  prev?: SubmissionNeighbor
  next?: SubmissionNeighbor
  /**
   * 1-based position of the current record. Absent until the counts are in, and
   * when there is no telling where the record sits.
   */
  index?: number
  /** How many records there are, which the API may only know as 'many' or 'unknown'. */
  total?: PaginatedDataResponseListCount
  /** Asks for fresh neighbours, after something changed the record's place in the list. */
  refresh: () => void
}

/**
 * The records either side of the given one, and where it sits among them.
 *
 * Rather than working from a list, this asks the API for the records next to it,
 * so it works the same whether the record is shown over the data table or at its
 * own address with no table at all.
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
  const queryClient = useQueryClient()
  const isEnabled = submissionId !== undefined

  // The params are still built when disabled, so that each record keeps its own
  // query key - the id is ignored until the query runs.
  const prevParams = getSubmissionNeighborParams(submissionId ?? 0, 'prev')
  const prevKey = getAssetsDataListQueryKey(assetUid, prevParams)
  const queryPrev = useAssetsDataList(assetUid, prevParams, {
    query: { queryKey: prevKey, select: selectNeighbor, enabled: isEnabled && !listPosition },
  })

  const nextParams = getSubmissionNeighborParams(submissionId ?? 0, 'next')
  const nextKey = getAssetsDataListQueryKey(assetUid, nextParams)
  const queryNext = useAssetsDataList(assetUid, nextParams, {
    query: { queryKey: nextKey, select: selectNeighbor, enabled: isEnabled && !listPosition },
  })

  const windowParams = getSubmissionListWindowParams(listPosition ?? { index: 0, sort: [] })
  const windowKey = getAssetsDataListQueryKey(assetUid, windowParams)
  const queryWindow = useAssetsDataList(assetUid, windowParams, {
    query: { queryKey: windowKey, select: selectWindow, enabled: isEnabled && Boolean(listPosition) },
  })

  const refresh = () => {
    for (const queryKey of listPosition ? [windowKey] : [prevKey, nextKey]) {
      queryClient.invalidateQueries({ queryKey })
    }
  }

  if (listPosition) {
    const rows = queryWindow.data?.rows ?? []
    const windowStart = Math.max(listPosition.index - LIST_WINDOW_REACH, 0)
    const toNeighbor = (rowIndex: number) => {
      const submission = rowIndex >= windowStart ? rows[rowIndex - windowStart] : undefined
      return submission && { rootUuid: getSubmissionRootUuid(submission), listIndex: rowIndex }
    }

    // `isLoading` rather than `isPending`, which stays true for a query that never runs.
    const isLoading = queryWindow.isLoading
    const total = queryWindow.data?.count

    // The record is usually where the table had it, but a record leaving or
    // joining the list before it (say, after a new validation status) shifts it.
    // Wherever we find it, that is its real place.
    const foundAt = rows.findIndex((row) => row._id === submissionId)
    if (foundAt !== -1) {
      const index = windowStart + foundAt
      return { isLoading, prev: toNeighbor(index - 1), next: toNeighbor(index + 1), index: index + 1, total, refresh }
    }

    // Not there at all - it dropped out of the filter, most likely. The rows that
    // closed up the gap are its neighbours now, and the counter has nothing to say.
    const { index } = listPosition
    return { isLoading, prev: toNeighbor(index - 1), next: toNeighbor(index), total, refresh }
  }

  const neighbors = {
    isLoading: queryPrev.isLoading || queryNext.isLoading,
    prev: queryPrev.data?.submission && { rootUuid: getSubmissionRootUuid(queryPrev.data.submission) },
    next: queryNext.data?.submission && { rootUuid: getSubmissionRootUuid(queryNext.data.submission) },
    refresh,
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
