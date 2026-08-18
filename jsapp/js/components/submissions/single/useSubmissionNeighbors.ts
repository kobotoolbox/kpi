import {
  type assetsDataListResponse,
  getAssetsDataListQueryKey,
  useAssetsDataList,
} from '#/api/react-query/survey-data'
import { getSubmissionRootUuid } from '#/utils'
import { getSubmissionNeighborParams } from './submissionRouting'

const selectNeighbor = (data: assetsDataListResponse) => {
  if (data.status !== 200) return
  if (!data.data.results.length) return
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
 * Where the given record sits among all the submissions the user can see, and
 * which records lie either side of it.
 *
 * Rather than working from a list, this asks the API for the single record on
 * each side plus how many lie that way - so it works the same whether the user
 * arrived from the data table, from the map, or from a link someone sent them.
 * Same approach as the single processing view's `SelectSubmission`.
 *
 * Note that it walks every submission the user can see. Filters applied in the
 * data table are that table's own state and have no bearing here.
 *
 * @param submissionDbId - `_id` of the record being displayed. Leave it out
 * while the record is still loading, and nothing is fetched.
 */
export function useSubmissionNeighbors(assetUid: string, submissionDbId?: number): SubmissionNeighbors {
  const isEnabled = submissionDbId !== undefined

  // The params are still built when disabled, so that each record keeps its own
  // query key - the id is ignored until the query runs.
  const prevParams = getSubmissionNeighborParams(submissionDbId ?? 0, 'prev')
  const queryPrev = useAssetsDataList(assetUid, prevParams, {
    query: { queryKey: getAssetsDataListQueryKey(assetUid, prevParams), select: selectNeighbor, enabled: isEnabled },
  })

  const nextParams = getSubmissionNeighborParams(submissionDbId ?? 0, 'next')
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
    prevRootUuid: queryPrev.data && getSubmissionRootUuid(queryPrev.data.submission),
    nextRootUuid: queryNext.data && getSubmissionRootUuid(queryNext.data.submission),
    index: hasCounts ? newerCount + 1 : undefined,
    total: hasCounts ? newerCount + olderCount + 1 : undefined,
  }
}
