import { Center, Group, Loader, Text } from '@mantine/core'
import { useInfiniteQuery } from '@tanstack/react-query'
import React, { useMemo, useEffect } from 'react'
import UniversalTableCore, { type UniversalTableColumn } from '#/UniversalTable/UniversalTableCore'
import { actions } from '#/actions'
import type { VersionListResponse } from '#/api/models/versionListResponse'
import { queryClient } from '#/api/queryClient'
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
  /**
   * This flag controls whether the component would be making any API calls. We have it here, because parent component
   * might be rendering this component visually hidden and we don't want to make unnecessary calls.
   */
  isEnabled: boolean
  assetUid: string
  deployedVersionId?: string
  deploymentActive?: boolean
  deploymentStatus?: string
  onClone: (versionUid: string) => void
}

/**
 * Displays a table with a list of previously deployed form versions
 */
export default function FormHistory(props: FormHistoryProps) {
  const isLoggedIn = sessionStore.isLoggedIn

  // Attach 'infinite' to the generated key to prevent cache collisions with standard query calls
  const AssetsVersionListQueryKeyInfinite = [...getAssetsVersionsListQueryKey(props.assetUid), 'infinite']

  useEffect(() => {
    // TODO: when gradually switching to Orval for all these actions below, make sure to write invalidating code in
    // `jsapp/js/api/mutation-defaults`
    const unlisteners = [
      // Whenever new version is deployed, we need to refresh
      actions.resources.deployAsset.completed.listen(() =>
        queryClient.invalidateQueries({ queryKey: AssetsVersionListQueryKeyInfinite }),
      ),
    ]
    return () => {
      unlisteners.forEach((clb) => clb())
    }
  }, [AssetsVersionListQueryKeyInfinite])

  // Wrap Orval's raw fetching function in TanStack's useInfiniteQuery
  const historyInfiniteQuery = useInfiniteQuery({
    queryKey: AssetsVersionListQueryKeyInfinite,
    // `pageParam` is the result of `getNextPageParam`
    queryFn: ({ pageParam, signal }) =>
      // TODO: for now this returns all versions, and we need to display only the deployed ones
      assetsVersionsList(props.assetUid, { limit: ITEMS_PER_PAGE, start: pageParam }, { signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // Type guard: ensure the request was successful and has a next page
      if (lastPage.status === 200 && lastPage.data.next) {
        // Calculate the next start based on how many pages we've fetched
        return allPages.length * ITEMS_PER_PAGE
      }
      return undefined
    },
    enabled: props.isEnabled,
  })

  // Flatten the pages into a single array for UniversalTableCore
  const rowData: VersionListResponse[] = useMemo(() => {
    return historyInfiniteQuery.data?.pages.flatMap((page) => (page.status === 200 ? page.data.results : [])) || []
  }, [historyInfiniteQuery.data])

  // Read total count from the first fetched page
  const totalCount =
    historyInfiniteQuery.data?.pages[0]?.status === 200 ? historyInfiniteQuery.data.pages[0].data.count : 0

  const showEndMessage = totalCount > ITEMS_PER_PAGE

  const columns: Array<UniversalTableColumn<VersionListResponse>> = useMemo(() => {
    const baseColumns: Array<UniversalTableColumn<VersionListResponse>> = [
      {
        key: 'version',
        label: t('Version'),
        cellFormatter: (value: VersionListResponse, index: number) => {
          const versionNumber = totalCount - index
          return (
            <Group gap='xs'>
              <Text>v{versionNumber}</Text>
              {value.uid === props.deployedVersionId && props.deploymentActive && (
                <AssetStatusBadge deploymentStatus={props.deploymentStatus} />
              )}
            </Group>
          )
        },
      },
      {
        key: 'date_deployed',
        label: t('Last Modified'),
        cellFormatter: (value: VersionListResponse) => {
          // TODO remove that casting after DEV-1823 is done
          if ((value.date_deployed as boolean | string) === false) {
            return <Text c='var(--mantine-color-gray-3)'>{t('Undeployed')}</Text>
          }
          return formatTime(value.date_deployed)
        },
      },
    ]

    if (isLoggedIn) {
      baseColumns.push({
        key: 'actions',
        label: t('Clone'),
        cellFormatter: (value: VersionListResponse) => (
          <ActionIcon
            variant='transparent'
            onClick={() => props.onClone(value.uid)}
            tooltip={t('Clone this version as a new project')}
            iconName='duplicate'
            size='md'
          />
        ),
      })
    }

    return baseColumns
  }, [totalCount, props.deployedVersionId, props.deploymentActive, props.deploymentStatus, isLoggedIn, props.onClone])

  if (historyInfiniteQuery.isLoading) {
    return (
      <Center p='xl'>
        <Loader />
      </Center>
    )
  }

  return (
    <UniversalTableCore<VersionListResponse>
      columns={columns}
      data={rowData}
      maxHeight={425}
      bottomContent={
        <InfiniteScrollTrigger
          hasNextPage={historyInfiniteQuery.hasNextPage}
          isFetchingNextPage={historyInfiniteQuery.isFetchingNextPage}
          isError={historyInfiniteQuery.isError}
          onRequestFetchNextPage={historyInfiniteQuery.fetchNextPage}
          showEndMessage={showEndMessage}
        />
      }
    />
  )
}
