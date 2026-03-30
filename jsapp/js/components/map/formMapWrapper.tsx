import {DataResponse} from "#/api/models/dataResponse"
import {useAssetsDataList, useAssetsDataRetrieve} from "#/api/react-query/survey-data"
import {useOrganizationAssumed} from "#/api/useOrganizationAssumed"
import {AssetResponse} from "#/dataInterface"
import {WithRouterProps} from "#/router/legacy"
import {keepPreviousData, useInfiniteQuery, useQuery} from "@tanstack/react-query"
import FormMap from '.'

interface FormMapProps extends WithRouterProps {
  asset: AssetResponse
  /** A question/row name for map to focus on given question data */
  viewby?: string
}

export default function FormMapWrapper(props: FormMapProps) {
  const querySubmission = useAssetsDataList(props.asset.uid, {limit: 30000}, {})

  let submissions: DataResponse[] = []

  if (querySubmission.data?.status === 200 && querySubmission.data.data.results.length > 0) {
    submissions = querySubmission.data.data.results
  }

  //const {
  //  data,
  //  error,
  //  fetchNextPage,
  //  hasNextPage,
  //  isFetching,
  //  isFetchingNextPage,
  //  status,
  //} = useInfiniteQuery({
  //  queryKey: ['submissions'],
  //  queryFn: useAssetsDataList(props.asset.uid, {limit: 30000}),
  //  initialPageParam: 0,
  //  getNextPageParam: (lastPage, pages) => lastPage.nextCursor,
  //})
  return (
    <FormMap asset={props.asset} querySubmission={querySubmission} submissions={submissions} />
  )
}
