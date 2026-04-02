import { Stack, Text } from '@mantine/core'
import React, { useEffect } from 'react'
import { actions } from '#/actions'
import { invalidatePaginatedList } from '#/api/mutation-defaults/common'
import { getAssetsListQueryKey, useAssetsCountsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
import {
  getOrganizationsAssetsCountsRetrieveQueryKey,
  getProjectViewsAssetsCountsRetrieveQueryKey,
  useOrganizationsAssetsCountsRetrieve,
  useProjectViewsAssetsCountsRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import { COMMON_QUERIES } from '#/constants'
import { PROJECTS_ROUTES } from '#/router/routerConstants'
import { getCurrentPath } from '#/router/routerUtils'
import { useSession } from '#/stores/useSession'
import LoadingSpinner from '../components/common/loadingSpinner'
import SidebarFormsListCategory from './SidebarFormsListCategory'

export const SidebarFormsListQueryKey = getAssetsListQueryKey({ q: COMMON_QUERIES.s, limit: 200, ordering: 'name' })

export type SidebarContext = 'my-projects' | 'my-org-projects' | 'custom-view-projects'

interface SidebarFormsListProps {
  context?: SidebarContext
  customViewUid?: string
}

function resolveContext(currentContext?: SidebarContext): SidebarContext {
  if (currentContext) {
    return currentContext
  }

  const currentPath = getCurrentPath()

  if (currentPath === PROJECTS_ROUTES.MY_ORG_PROJECTS) {
    return 'my-org-projects'
  }

  if (currentPath.startsWith(PROJECTS_ROUTES.CUSTOM_VIEW.replace(':viewUid', ''))) {
    return 'custom-view-projects'
  }

  return 'my-projects'
}

function resolveCustomViewUid(currentContext: SidebarContext, providedCustomViewUid?: string): string | undefined {
  if (currentContext === 'custom-view-projects') {
    if (providedCustomViewUid) {
      return providedCustomViewUid
    }

    const currentPath = getCurrentPath()
    const pathSegments = currentPath.split('/')

    // expecting `/projects/<viewUid>`
    if (pathSegments.length >= 3) {
      return pathSegments[2]
    }
  }

  return undefined
}

/**
 * A list of projects grouped by status (deployed, draft, archived). It's meant to be displayed in the sidebar area.
 */
export default function SidebarFormsList({ context, customViewUid }: SidebarFormsListProps) {
  const session = useSession()
  const orgUid = session.currentLoggedAccount?.organization?.uid

  const resolvedContext = resolveContext(context)
  const resolvedCustomViewUid = resolveCustomViewUid(resolvedContext, customViewUid)

  const countsQuery =
    resolvedContext === 'my-projects'
      ? useAssetsCountsRetrieve()
      : resolvedContext === 'my-org-projects'
        ? useOrganizationsAssetsCountsRetrieve(orgUid ?? '', {
            query: {
              queryKey: getOrganizationsAssetsCountsRetrieveQueryKey(orgUid ?? ''),
              enabled: !!orgUid,
            },
          })
        : useProjectViewsAssetsCountsRetrieve(resolvedCustomViewUid ?? '', {
            query: {
              queryKey: getProjectViewsAssetsCountsRetrieveQueryKey(resolvedCustomViewUid ?? ''),
              enabled: !!resolvedCustomViewUid,
            },
          })

  useEffect(() => {
    const unlisteners = [
      actions.resources.deleteAsset.completed.listen(() => invalidatePaginatedList(['api', 'v2', 'assets'])),
      actions.resources.cloneAsset.completed.listen(() => invalidatePaginatedList(['api', 'v2', 'assets'])),
      actions.resources.deployAsset.completed.listen(() => invalidatePaginatedList(['api', 'v2', 'assets'])),
      actions.resources.setDeploymentActive.completed.listen(() => invalidatePaginatedList(['api', 'v2', 'assets'])),
      actions.resources.updateAsset.completed.listen(() => invalidatePaginatedList(['api', 'v2', 'assets'])),
      actions.permissions.removeAssetPermission.completed.listen(() =>
        invalidatePaginatedList(['api', 'v2', 'assets']),
      ),
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
