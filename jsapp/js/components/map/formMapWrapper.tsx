import { useQueries, useQuery } from '@tanstack/react-query'
import { useLayoutEffect, useState } from 'react'
import { assetsDataList, getAssetsDataListQueryKey } from '#/api/react-query/survey-data'
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
 * Wrapper for the `FormMap` component so we can use hooks without doing a full refactor of `FormMap`
 */
export default function FormMapWrapper(props: FormMapWrapperProps) {
  const [pageCount, setPageCount] = useState(DEFAULT_PAGE_SIZE)
  const [fields, setFields] = useState<string | undefined>(undefined)
  // How many pages have been started, when we have to request them one at a time. Kept along with the `fields` it was
  // counted for, so that new fields start again from the first page on the same render - an effect resetting it would
  // let the old count request new pages first.
  const [pageProgress, setPageProgress] = useState<{ fields?: string; count: number }>({ count: 1 })
  // Hard coded the sorting produced by `getSubmissions`
  const sort = JSON.stringify({ _id: -1 })

  // We need several pages of queries because the data API is limited to 1000 results per page
  const getPageQueryOptions = (index: number) => {
    return {
      queryKey: [...getAssetsDataListQueryKey(props.asset.uid), fields, 'page', index, sort],
      queryFn: () =>
        assetsDataList(props.asset.uid, {
          fields: fields || undefined,
          start: index * SUBMISSIONS_PER_PAGE,
          limit: SUBMISSIONS_PER_PAGE,
          sort: sort,
        }),
      // There can be up to 30 pages, so avoid refetching or retrying them all at once. They are still refetched whenever
      // the map is opened, as nothing invalidates them when submissions are added, edited or deleted
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }

  // The first page is requested on its own, as its count decides how we request the rest
  const firstPage = useQuery({ ...getPageQueryOptions(0), enabled: fields !== undefined })
  // Only once it has (re)loaded, to avoid using stale data
  const totalCount = firstPage.data?.status === 200 && !firstPage.isFetching ? firstPage.data.data.count : undefined

  // With an exact count, `pageCount` is already capped to the pages holding submissions, so we request them all at once.
  // So we do with 'many': we don't know where the submissions end, but counting up to the cap was quick, so requesting
  // past the end is cheap. 'unknown' means counting timed out, so these queries are slow - there we request one page at
  // a time, each once the one before it says there is a next page, so we never request pages past the end.
  const canRequestAllPages = typeof totalCount === 'number' || totalCount === 'many'
  const startedPages = canRequestAllPages ? pageCount : pageProgress.fields === fields ? pageProgress.count : 1

  const otherPages = useQueries({
    queries: Array.from({ length: Math.max(pageCount - 1, 0) }).map((_, otherIndex) => {
      const index = otherIndex + 1
      return { ...getPageQueryOptions(index), enabled: fields !== undefined && index < startedPages }
    }),
  })
  const results = [firstPage].concat(otherPages)

  // Only the pages this load has reached: the others can still hold data cached by an earlier load, which may have since
  // been deleted, and would otherwise stay on the map if this load finds the submissions end sooner
  const allData = results
    .slice(0, startedPages)
    .filter((result) => result.isSuccess)
    .flatMap((result) => {
      if (result.data && result.data.status === 200) {
        return result.data.data.results || []
      }
      return []
    })

  const latestPage = results[startedPages - 1]
  const canStartNextPage =
    !canRequestAllPages &&
    startedPages < pageCount &&
    latestPage?.isSuccess === true &&
    !latestPage.isFetching &&
    latestPage.data?.status === 200 &&
    Boolean(latestPage.data.data.next)

  // A layout effect starts the next page before the browser paints, so the loading message doesn't blink off in between
  useLayoutEffect(() => {
    if (canStartNextPage) {
      setPageProgress({ fields, count: startedPages + 1 })
    }
  }, [canStartNextPage, fields, startedPages])

  const isLoading = results.some((result) => result.isLoading)

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
