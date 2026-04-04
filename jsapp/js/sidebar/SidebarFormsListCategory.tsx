import { Box, Center, Group, Loader, Stack, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { InfiniteData } from '@tanstack/query-core'
import { useInfiniteQuery } from '@tanstack/react-query'
import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { AssetMinimalList } from '#/api/models/assetMinimalList'
import type { AssetsMinimalListRetrieveParams } from '#/api/models/assetsMinimalListRetrieveParams'
import {
  assetsMinimalListRetrieve,
  type assetsMinimalListRetrieveResponse,
} from '#/api/react-query/manage-projects-and-library-content'
import {
  organizationsAssetsMinimalListRetrieve,
  type organizationsAssetsMinimalListRetrieveResponse,
  projectViewsAssetsMinimalListRetrieve,
  type projectViewsAssetsMinimalListRetrieveResponse,
} from '#/api/react-query/user-team-organization-usage'
import InfiniteScrollTrigger from '#/components/common/InfiniteScrollTrigger'
import { ROUTES } from '#/router/routerConstants'
import { getRouteAssetUid } from '#/router/routerUtils'
import AssetName from '../components/common/assetName'
import Badge from '../components/common/badge'
import type { SidebarContext } from './SidebarFormsList'
import styles from './SidebarFormsList.module.scss'

const ITEMS_PER_PAGE = 20

type SidebarFormsListCategoryResponse =
  | assetsMinimalListRetrieveResponse
  | organizationsAssetsMinimalListRetrieveResponse
  | projectViewsAssetsMinimalListRetrieveResponse

interface SidebarFormsListCategoryProps {
  context: SidebarContext
  deploymentStatus: 'deployed' | 'draft' | 'archived'
  totalCount: number
  organizationId?: string
  projectViewUid?: string
}

/**
 * Displays a toggleable button with total count and a list of projects for a specific context and deployment status.
 */
export default function SidebarFormsListCategory(props: SidebarFormsListCategoryProps) {
  const [isProjectsListVisible, projectsListHandlers] = useDisclosure(false)

  const queryFilter = `asset_type:survey AND _deployment_status:${props.deploymentStatus}`

  const query = useInfiniteQuery<
    SidebarFormsListCategoryResponse,
    Error,
    InfiniteData<SidebarFormsListCategoryResponse>,
    readonly unknown[],
    number
  >({
    queryKey: [
      'sidebarAssetsMinimalList',
      props.context,
      props.deploymentStatus,
      props.organizationId,
      props.projectViewUid,
      queryFilter,
    ],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }: { pageParam: number }) => {
      const params: AssetsMinimalListRetrieveParams = {
        q: queryFilter,
        limit: ITEMS_PER_PAGE,
        start: pageParam,
      }

      if (props.context === 'my-projects') {
        return assetsMinimalListRetrieve(params)
      } else if (props.context === 'my-org-projects') {
        if (!props.organizationId) {
          throw new Error('organizationId is required for org-projects context')
        }
        return organizationsAssetsMinimalListRetrieve(props.organizationId, params)
      } else if (props.context === 'custom-view-projects') {
        if (!props.projectViewUid) {
          throw new Error('projectViewUid is required for custom-view-projects context')
        }
        return projectViewsAssetsMinimalListRetrieve(props.projectViewUid, params)
      }

      throw new Error('Unsupported context')
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.status === 200 && 'next' in lastPage.data && lastPage.data.next) {
        return allPages.length * ITEMS_PER_PAGE
      }
      return undefined
    },
    enabled:
      // Only call API when component is toggle-opened
      isProjectsListVisible &&
      (props.context !== 'my-org-projects' || !!props.organizationId) &&
      (props.context !== 'custom-view-projects' || !!props.projectViewUid),
    // For now let's not refetch, as sometimes there might be multiple pages loaded at once
    refetchOnWindowFocus: false,
  })

  const rows = useMemo(() => {
    return (query.data?.pages.flatMap((page: SidebarFormsListCategoryResponse) =>
      page.status === 200 && 'results' in page.data ? page.data.results : [],
    ) || []) as AssetMinimalList[]
  }, [query.data])

  const isLoading = isProjectsListVisible && query.isLoading

  const categoryLable =
    props.deploymentStatus === 'deployed'
      ? t('Deployed')
      : props.deploymentStatus === 'draft'
        ? t('Draft')
        : t('Archived')

  return (
    <>
      <UnstyledButton
        size='md'
        variant='transparent'
        onClick={projectsListHandlers.toggle}
        className={styles.categoryButton}
      >
        <Group gap='xs'>
          <Box flex={1}>{categoryLable}</Box>
          <Badge label={props.totalCount} color='light-storm' size='xs' />
        </Group>
      </UnstyledButton>

      {isProjectsListVisible && (
        <Stack className={styles.categoryList} gap='0'>
          {isLoading && (
            <Center p='xl'>
              <Loader />
            </Center>
          )}

          {!isLoading && !query.isError && rows.length === 0 && <Text p='sm'>{t('No projects found')}</Text>}

          {!isLoading &&
            rows.map((asset) => {
              // The minimal-list endpoints only return a subset of asset fields, they do not provide enough information
              // to reproduce the previous conditional routing to summary/landing views, so sidebar items intentionally
              // link to the default form route instead.
              const href = ROUTES.FORM.replace(':uid', asset.uid)
              const isActiveProject = asset.uid === getRouteAssetUid()

              return (
                <Link
                  key={asset.uid}
                  to={href}
                  style={{ background: isActiveProject ? 'var(--mantine-color-gray-7)' : 'transparent' }}
                  className={styles.projectLink}
                >
                  <Text fz='12' p='3 6'>
                    <AssetName asset={asset} />
                  </Text>
                </Link>
              )
            })}

          <InfiniteScrollTrigger
            hasNextPage={query.hasNextPage}
            isFetchingNextPage={query.isFetchingNextPage}
            isError={query.isError}
            onRetry={() => {
              if (query.hasNextPage) {
                query.fetchNextPage()
              } else {
                query.refetch()
              }
            }}
            onRequestFetchNextPage={query.fetchNextPage}
            // Never show the end message
            showEndMessage={false}
          />
        </Stack>
      )}
    </>
  )
}
