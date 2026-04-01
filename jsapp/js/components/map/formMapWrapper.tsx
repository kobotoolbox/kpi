import { useQueries } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { assetsDataList, getAssetsDataListQueryKey } from '#/api/react-query/survey-data'
import type { AssetResponse } from '#/dataInterface'
import type { WithRouterProps } from '#/router/legacy'
import FormMap from '.'

interface FormMapProps extends WithRouterProps {
  asset: AssetResponse
  /** A question/row name for map to focus on given question data */
  viewby?: string
}

export default function FormMapWrapper(props: FormMapProps) {
  const [pageCount, setPageCount] = useState(5)
  const [fields, setFields] = useState<string | undefined>(undefined)
  const [foundSelectedQuestion, setFoundSelectedQuestion] = useState<string | null>(null)
  console.log('current fields', fields)
  console.log('current selected', foundSelectedQuestion)

  const queryOptions = useMemo(
    () =>
      Array.from({ length: pageCount }).map((_, index) => {
        if (fields) {
          console.log('queryOptions current pageCount', pageCount)
        }
        return {
          queryKey: [...getAssetsDataListQueryKey(props.asset.uid), fields, 'pageCount', pageCount, 'page', index],
          queryFn: () =>
            assetsDataList(props.asset.uid, {
              fields: fields || undefined,
              start: index * 1000,
              limit: 1000,
            }),
          enabled: fields !== undefined,
        }
      }),
    [pageCount, fields],
  )

  const results = useQueries({ queries: queryOptions })
  const isLoading = results.some((result) => result.isLoading)
  const isError = results.some((result) => result.isError)

  const allData = results
    .filter((result) => result.isSuccess)
    .flatMap((result) => {
      if (result.data && result.data.status === 200) {
        return result.data.data.results || []
      }
      return []
    })

  return (
    <FormMap
      asset={props.asset}
      pageCount={pageCount}
      setPageCount={setPageCount}
      isLoading={isLoading}
      isError={isError}
      allData={allData}
      setFields={setFields}
      foundSelectedQuestion={foundSelectedQuestion}
      setFoundSelectedQuestion={setFoundSelectedQuestion}
    />
  )
}
