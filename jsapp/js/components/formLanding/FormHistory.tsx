import { Center, Group, Loader, Text } from '@mantine/core'
import { useInfiniteQuery } from '@tanstack/react-query'
import React, { useMemo } from 'react'
import UniversalTableCore from '#/UniversalTable/UniversalTableCore'
// 1. Import the raw fetching function and the query key builder from your Orval endpoints
import {
  assetsVersionsList,
  getAssetsVersionsListQueryKey,
} from '#/api/react-query/manage-projects-and-library-content'
import ActionIcon from '#/components/common/ActionIcon'
import { InfiniteScrollTrigger } from '#/components/common/InfiniteScrollTrigger'
import AssetStatusBadge from '#/components/common/assetStatusBadge'
import sessionStore from '#/stores/session'
import { formatTime } from '#/utils'

const ITEMS_PER_PAGE = 10

export interface FormHistoryProps {
  assetUid: string
  deployedVersionId?: string
  deploymentActive?: boolean
  deploymentStatus?: string
  onClone: (versionUid: string) => void
}

export default function FormHistory(props: FormHistoryProps) {
  const isLoggedIn = sessionStore.isLoggedIn

  // 2. Wrap Orval's raw fetching function in TanStack's useInfiniteQuery
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError, isLoading } = useInfiniteQuery({
    // Attach 'infinite' to the generated key to prevent cache collisions with any standard useQuery calls
    queryKey: [...getAssetsVersionsListQueryKey(props.assetUid), 'infinite'],
    // pageParam is injected by TanStack based on getNextPageParam
    queryFn: ({ pageParam, signal }) =>
      assetsVersionsList(props.assetUid, { limit: ITEMS_PER_PAGE, offset: pageParam as number }, { signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // Type guard: ensure the request was successful and has a next page
      if (lastPage.status === 200 && lastPage.data.next) {
        // Calculate the next offset based on how many pages we've fetched
        return allPages.length * ITEMS_PER_PAGE
      }
      return undefined
    },
  })

  // 3. Flatten the pages into a single array for UniversalTableCore, strictly typing for status 200
  const flattenedData = useMemo(() => {
    return data?.pages.flatMap((page) => (page.status === 200 ? page.data.results : [])) || []
  }, [data])

  // Read total count from the first fetched page
  const totalCount = data?.pages[0]?.status === 200 ? data.pages[0].data.count : 0

  const showEndMessage = totalCount > ITEMS_PER_PAGE

  const columns = useMemo(() => {
    const baseColumns: any[] = [
      {
        id: 'version',
        header: t('Version'),
        cell: (info: any) => {
          const item = info.row.original
          const versionNumber = totalCount - info.row.index
          return (
            <Group gap='xs'>
              <Text>v{versionNumber}</Text>
              {item.uid === props.deployedVersionId && props.deploymentActive && (
                <AssetStatusBadge deploymentStatus={props.deploymentStatus} />
              )}
            </Group>
          )
        },
      },
      {
        id: 'date',
        header: t('Last Modified'),
        accessorKey: 'date_deployed',
        cell: (info: any) => formatTime(info.getValue()),
      },
    ]

    if (isLoggedIn) {
      baseColumns.push({
        id: 'actions',
        header: t('Clone'),
        cell: (info: any) => (
          <ActionIcon
            variant='transparent'
            onClick={() => props.onClone(info.row.original.uid)}
            tooltip={t('Clone this version as a new project')}
            iconName='duplicate'
            size='md'
          />
        ),
      })
    }

    return baseColumns
  }, [totalCount, props.deployedVersionId, props.deploymentActive, props.deploymentStatus, isLoggedIn, props.onClone])

  if (isLoading) {
    return (
      <Center p='xl'>
        <Loader />
      </Center>
    )
  }

  return (
    <UniversalTableCore
      columns={columns}
      data={flattenedData}
      maxHeight={425}
      bottomContent={
        <InfiniteScrollTrigger
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isError={isError}
          fetchNextPage={fetchNextPage}
          showEndMessage={showEndMessage}
        />
      }
    />
  )
}
