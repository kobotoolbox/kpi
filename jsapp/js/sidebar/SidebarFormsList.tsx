import { Stack, Text } from '@mantine/core'
import type { QueryKey } from '@tanstack/react-query'
import React, { useEffect } from 'react'
import { actions } from '#/actions'
import { queryClient } from '#/api/queryClient'
import {
  getAssetsCountsRetrieveQueryKey,
  useAssetsCountsRetrieve,
} from '#/api/react-query/manage-projects-and-library-content'
import {
  getOrganizationsAssetsCountsRetrieveQueryKey,
  getProjectViewsAssetsCountsRetrieveQueryKey,
  useOrganizationsAssetsCountsRetrieve,
  useProjectViewsAssetsCountsRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import { PROJECTS_ROUTES } from '#/router/routerConstants'
import { getCurrentPath } from '#/router/routerUtils'
import { useSession } from '#/stores/useSession'
import LoadingSpinner from '../components/common/loadingSpinner'
import SidebarFormsListCategory from './SidebarFormsListCategory'

export type SidebarContext = 'my-projects' | 'my-org-projects' | 'custom-view-projects'

export function resolveSidebarContext(): SidebarContext {
  const currentPath = getCurrentPath()

  if (currentPath === PROJECTS_ROUTES.MY_ORG_PROJECTS) {
    return 'my-org-projects'
  }

  if (currentPath === PROJECTS_ROUTES.MY_PROJECTS) {
    return 'my-projects'
  }

  if (
    currentPath !== PROJECTS_ROUTES.MY_PROJECTS &&
    currentPath.startsWith(PROJECTS_ROUTES.CUSTOM_VIEW.replace(':viewUid', ''))
  ) {
    return 'custom-view-projects'
  }

  // Fallback
  return 'my-projects'
}

export function resolveCustomViewUid(currentContext: SidebarContext): string | undefined {
  if (currentContext === 'custom-view-projects') {
    const currentPath = getCurrentPath()
    const pathSegments = currentPath.split('/')

    // expecting `/projects/<viewUid>`
    if (pathSegments.length >= 3) {
      return pathSegments[2]
    }
  }

  return undefined
}

export function invalidateSidebarQueries() {
  // Invalidate all sidebar counts queries (any query key ending with 'counts')
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey
      return key[key.length - 1] === 'counts'
    },
  })

  // Refetch all active sidebar infinite queries (starting with 'sidebarAssetsMinimalList')
  queryClient.refetchQueries({
    queryKey: ['sidebarAssetsMinimalList'],
    type: 'active',
  })
}

/**
 * A list of projects grouped by status (deployed, draft, archived). It's meant to be displayed in the sidebar area.
 */
export default function SidebarFormsList() {
  const session = useSession()
  const orgUid = session.currentLoggedAccount?.organization?.uid

  const resolvedContext = resolveSidebarContext()
  const resolvedCustomViewUid = resolveCustomViewUid(resolvedContext)

  const countsQueryKey: QueryKey = (() => {
    switch (resolvedContext) {
      case 'my-org-projects':
        return getOrganizationsAssetsCountsRetrieveQueryKey(orgUid ?? '')
      case 'custom-view-projects':
        return getProjectViewsAssetsCountsRetrieveQueryKey(resolvedCustomViewUid ?? '')
      case 'my-projects':
      default:
        return getAssetsCountsRetrieveQueryKey()
    }
  })()

  const countsQuery =
    resolvedContext === 'my-projects'
      ? useAssetsCountsRetrieve({
          query: {
            queryKey: countsQueryKey,
          },
        })
      : resolvedContext === 'my-org-projects'
        ? useOrganizationsAssetsCountsRetrieve(orgUid ?? '', {
            query: {
              queryKey: countsQueryKey,
              enabled: !!orgUid,
            },
          })
        : useProjectViewsAssetsCountsRetrieve(resolvedCustomViewUid ?? '', {
            query: {
              queryKey: countsQueryKey,
              enabled: !!resolvedCustomViewUid,
            },
          })

  useEffect(() => {
    const unlisteners = [
      actions.resources.deleteAsset.completed.listen(invalidateSidebarQueries),
      actions.resources.cloneAsset.completed.listen(invalidateSidebarQueries),
      actions.resources.deployAsset.completed.listen(invalidateSidebarQueries),
      actions.resources.setDeploymentActive.completed.listen(invalidateSidebarQueries),
      actions.resources.updateAsset.completed.listen(invalidateSidebarQueries),
      actions.permissions.removeAssetPermission.completed.listen(invalidateSidebarQueries),
    ]
    return () => {
      unlisteners.forEach((clb) => clb())
    }
  }, [])

  if (countsQuery.isLoading) {
    return <LoadingSpinner />
  }

  if (countsQuery.error || countsQuery.data?.status !== 200) {
    return <Text>{t('Could not load asset counts')}</Text>
  }

  const assetCounts = countsQuery.data.data
  const deployedCount = assetCounts?.deployed_count ?? 0
  const draftCount = assetCounts?.draft_count ?? 0
  const archivedCount = assetCounts?.archived_count ?? 0

  return (
    <Stack style={{ minHeight: 0 }}>
      <SidebarFormsListCategory
        context={resolvedContext}
        deploymentStatus='deployed'
        totalCount={deployedCount}
        organizationId={resolvedContext === 'my-org-projects' ? orgUid : undefined}
        projectViewUid={resolvedContext === 'custom-view-projects' ? resolvedCustomViewUid : undefined}
      />

      <SidebarFormsListCategory
        context={resolvedContext}
        deploymentStatus='draft'
        totalCount={draftCount}
        organizationId={resolvedContext === 'my-org-projects' ? orgUid : undefined}
        projectViewUid={resolvedContext === 'custom-view-projects' ? resolvedCustomViewUid : undefined}
      />

      <SidebarFormsListCategory
        context={resolvedContext}
        deploymentStatus='archived'
        totalCount={archivedCount}
        organizationId={resolvedContext === 'my-org-projects' ? orgUid : undefined}
        projectViewUid={resolvedContext === 'custom-view-projects' ? resolvedCustomViewUid : undefined}
      />
    </Stack>
  )
}
