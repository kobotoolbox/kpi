import { useQueries } from '@tanstack/react-query'
import { useState } from 'react'
import { assetsDataList, getAssetsDataListQueryKey } from '#/api/react-query/survey-data'
import type { AssetResponse } from '#/dataInterface'
import type { WithRouterProps } from '#/router/legacy'
import FormMap from '.'

interface FormMapProps extends WithRouterProps {
  asset: AssetResponse
  /** A question/row name for map to focus on given question data */
  viewby?: string
}

const DEFAULT_PAGE_SIZE = 1
const SUBMISSIONS_PER_PAGE = 1000

export default function FormMapWrapper(props: FormMapProps) {
  const [pageCount, setPageCount] = useState(DEFAULT_PAGE_SIZE)
  const [fields, setFields] = useState<string | undefined>(undefined)
  // Hard coded the sorting produced by `getSubmssions`
  const sort = JSON.stringify({ _id: -1 })

  const queryOptions = Array.from({ length: pageCount }).map((_, index) => {
    return {
      queryKey: [...getAssetsDataListQueryKey(props.asset.uid), fields, 'page', index, sort],
      queryFn: () =>
        assetsDataList(props.asset.uid, {
          fields: fields || undefined,
          start: index * SUBMISSIONS_PER_PAGE,
          limit: SUBMISSIONS_PER_PAGE,
          sort: sort,
        }),
      enabled: fields !== undefined,
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
