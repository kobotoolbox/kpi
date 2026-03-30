import {DataResponse} from "#/api/models/dataResponse"
import {assetsDataList, getAssetsDataListQueryKey,} from "#/api/react-query/survey-data"
import {AssetResponse} from "#/dataInterface"
import {WithRouterProps} from "#/router/legacy"
import {useInfiniteQuery} from "@tanstack/react-query"
import FormMap from '.'
import {useEffect} from "react"

interface FormMapProps extends WithRouterProps {
  asset: AssetResponse
  /** A question/row name for map to focus on given question data */
  viewby?: string
}

export default function FormMapWrapper(props: FormMapProps) {

  //useEffect(() => {
  //  fetchAllPages()
  //}, [])

  const query = useInfiniteQuery({
    queryKey: [...getAssetsDataListQueryKey(props.asset.uid), 'infinite'],
    queryFn: ({ pageParam, signal }) =>
      assetsDataList(props.asset.uid, { limit: 1000, start: pageParam}, { signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (allPages.length >= 10) {
        return undefined
      }
      if (lastPage.status === 200 && lastPage.data.next) {
        return allPages.length * 1000
      }
      return undefined
    },
  })


  const fetchAllPages = async () => {
    console.log('called')
    let hasMore = query.hasNextPage

    while (hasMore) {
      console.log('page', query.data?.pages.length)
      const result = await query.fetchNextPage()
      hasMore = result.hasNextPage ?? false
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log('doine', allSubmissions)
  }

  const allSubmissions: DataResponse[] = query.data?.pages.flatMap((page) => (page.status === 200 ? page.data.results : [])) || []

  return (
    <FormMap asset={props.asset} qs={query} fa={fetchAllPages} all={allSubmissions}/>
  )
}
