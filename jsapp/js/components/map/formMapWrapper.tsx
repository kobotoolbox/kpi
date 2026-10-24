import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { assetsDataList, type assetsDataListResponse, getAssetsDataListQueryKey } from '#/api/react-query/survey-data'
import type { AssetResponse } from '#/dataInterface'
import FormMap from '.'
import { SUBMISSIONS_PER_PAGE } from './mapUtils'

interface FormMapWrapperProps {
  asset: AssetResponse
  /** A question/row name for map to focus on given question data */
  viewby?: string
}

const DEFAULT_PAGE_SIZE = 1
/**
 * Pages are requested this many at a time. Each batch waits for the last page of the one before it to say there is a
 * next page, so we stop shortly after the submissions run out, and never have more than this many requests in flight.
 */
const PAGES_PER_BATCH = 5

/**
 * Wrapper for the `FormMap` component so we can use hooks without doing a full refactor of `FormMap`
 */
export default function FormMapWrapper(props: FormMapWrapperProps) {
  const [pageCount, setPageCount] = useState(DEFAULT_PAGE_SIZE)
  const [fields, setFields] = useState<string | undefined>(undefined)
  const queryClient = useQueryClient()
  // Hard coded the sorting produced by `getSubmissions`
  const sort = JSON.stringify({ _id: -1 })

  const getPageQueryKey = (index: number) => [
    ...getAssetsDataListQueryKey(props.asset.uid),
    fields,
    'page',
    index,
    sort,
  ]

  /**
   * Whether the batch holding the given page can be requested. Reads the cache rather than the results below, as the
   * options have to be built first - this re-renders whenever a page loads anyway.
   */
  const isPageBatchReady = (index: number) => {
    const batchStart = index - (index % PAGES_PER_BATCH)
    if (batchStart === 0) {
      return true
    }
    const previousPage = queryClient.getQueryData<assetsDataListResponse>(getPageQueryKey(batchStart - 1))
    return previousPage?.status === 200 && Boolean(previousPage.data.next)
  }

  // We generate `pageCount` amount of queries because the data API is limited to 1000 results per page
  const queryOptions = Array.from({ length: pageCount }).map((_, index) => {
    // eslint-disable-next-line @tanstack/query/exhaustive-deps -- `getPageQueryKey()` includes everything `queryFn` uses
    return {
      queryKey: getPageQueryKey(index),
      queryFn: () =>
        assetsDataList(props.asset.uid, {
          fields: fields || undefined,
          start: index * SUBMISSIONS_PER_PAGE,
          limit: SUBMISSIONS_PER_PAGE,
          sort: sort,
        }),
      enabled: fields !== undefined && isPageBatchReady(index),
      // There can be up to 30 pages, so avoid refetching or retrying them all at once. They are still refetched whenever
      // the map is opened, as nothing invalidates them when submissions are added, edited or deleted
      refetchOnWindowFocus: false,
      retry: 1,
    }
  })

  const results = useQueries({ queries: queryOptions })
  const allData = results
    .filter((result) => result.isSuccess)
    .flatMap((result) => {
      if (result.data && result.data.status === 200) {
        return result.data.data.results || []
      }
      return []
    })
  const isLoading = results.some((result) => result.isLoading)
  // Get total count from first query (only if not currently refetching to avoid stale data)
  const totalCount =
    results[0]?.data?.status === 200 && !results[0]?.isFetching ? results[0].data.data.count : undefined

  return (
    <FormMap
      asset={props.asset}
      viewby={props.viewby ?? ''}
      allData={allData}
      isLoading={isLoading}
      totalCount={totalCount}
      pageCount={pageCount}
      setPageCount={setPageCount}
      setFields={setFields}
    />
  )
}
