import { Stack, Text } from '@mantine/core'
import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
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
import { useSession } from '#/stores/useSession'
import LoadingSpinner from '../components/common/loadingSpinner'
import SidebarFormsListCategory from './SidebarFormsListCategory'
import type { SidebarContext } from './sidebar.types'

function resolveSidebarContext(currentPath: string): SidebarContext {
  if (currentPath === PROJECTS_ROUTES.MY_ORG_PROJECTS) {
    return 'my-org-projects'
  } else if (currentPath === PROJECTS_ROUTES.MY_PROJECTS) {
    return 'my-projects'
  } else if (currentPath.startsWith(PROJECTS_ROUTES.CUSTOM_VIEW.replace(':viewUid', ''))) {
    return 'custom-view-projects'
  }
  // Fallback
  return 'my-projects'
}

function resolveCustomViewUid(currentPath: string): string | undefined {
  const customViewPrefix = PROJECTS_ROUTES.CUSTOM_VIEW.replace(':viewUid', '')
  if (!currentPath.startsWith(customViewPrefix)) return undefined

  const pathSegments = currentPath.split('/')
  // expecting `/projects/<viewUid>`
  if (pathSegments.length >= 3) {
    return pathSegments[2]
  }
  return undefined
}

export function invalidateSidebarQueries(orgUid?: string, customViewUid?: string) {
  // Always invalidate all 3 counts queries
  queryClient.invalidateQueries({
    queryKey: getAssetsCountsRetrieveQueryKey(),
  })
  if (orgUid) {
    queryClient.invalidateQueries({
      queryKey: getOrganizationsAssetsCountsRetrieveQueryKey(orgUid),
    })
  }
  if (customViewUid) {
    queryClient.invalidateQueries({
      queryKey: getProjectViewsAssetsCountsRetrieveQueryKey(customViewUid),
    })
  }

  // Invalidate all sidebar infinite list queries by predicate
  // When orgUid or customViewUid are undefined, we invalidate all related queries
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey
      if (key[0] !== 'sidebarAssetsMinimalList') return false

      const context = key[1]
      if (context === 'my-projects') return true
      if (context === 'my-org-projects') return !orgUid || key[3] === orgUid
      if (context === 'custom-view-projects') return !customViewUid || key[4] === customViewUid

      return false
    },
  })
}

/**
 * A list of projects grouped by status (deployed, draft, archived). It's meant to be displayed in the sidebar area.
 */
export default function SidebarFormsList() {
  const session = useSession()
  const orgUid = session.currentLoggedAccount?.organization?.uid
  const location = useLocation()
  const currentPath = location.pathname

  const resolvedContext = resolveSidebarContext(currentPath)
  const resolvedCustomViewUid = resolveCustomViewUid(currentPath)

  // Always call all 3 hooks to avoid "more/fewer hooks than during previous render" errors
  const countsQueryMyProjects = useAssetsCountsRetrieve({
    query: {
      // TODO: this prop shouldn't be required, see https://github.com/orval-labs/orval/issues/2396
      queryKey: getAssetsCountsRetrieveQueryKey(),
      enabled: resolvedContext === 'my-projects',
    },
  })

  const countsQueryOrgProjects = useOrganizationsAssetsCountsRetrieve(orgUid ?? '', {
    query: {
      queryKey: getOrganizationsAssetsCountsRetrieveQueryKey(orgUid ?? ''),
      enabled: resolvedContext === 'my-org-projects' && !!orgUid,
    },
  })

  const countsQueryCustomView = useProjectViewsAssetsCountsRetrieve(resolvedCustomViewUid ?? '', {
    query: {
      queryKey: getProjectViewsAssetsCountsRetrieveQueryKey(resolvedCustomViewUid ?? ''),
      enabled: resolvedContext === 'custom-view-projects' && !!resolvedCustomViewUid,
    },
  })

  // Pick the active hook based on context
  const countsQuery =
    resolvedContext === 'my-projects'
      ? countsQueryMyProjects
      : resolvedContext === 'my-org-projects'
        ? countsQueryOrgProjects
        : countsQueryCustomView

  useEffect(() => {
    const invalidateSidebar = () => invalidateSidebarQueries(orgUid, resolvedCustomViewUid)
    // TODO: when gradually switching to Orval for all these actions below, make sure to write invalidating code in
    // `jsapp/js/api/mutation-defaults`
    const unlisteners = [
      actions.resources.deleteAsset.completed.listen(invalidateSidebar),
      actions.resources.cloneAsset.completed.listen(invalidateSidebar),
      actions.resources.deployAsset.completed.listen(invalidateSidebar),
      actions.resources.setDeploymentActive.completed.listen(invalidateSidebar),
      actions.resources.updateAsset.completed.listen(invalidateSidebar),
      actions.permissions.removeAssetPermission.completed.listen(invalidateSidebar),
    ]
    return () => {
      unlisteners.forEach((clb) => clb())
    }
  }, [orgUid, resolvedCustomViewUid])

  if (countsQuery.isLoading) {
    return <LoadingSpinner />
  }

  if (countsQuery.error || countsQuery.data?.status !== 200) {
    return <Text>{t('Could not load asset counts')}</Text>
  }

  return (
    // minHeight needed for flex to work properly with scrollable containers
    <Stack style={{ minHeight: 0 }}>
      <SidebarFormsListCategory
        context={resolvedContext}
        deploymentStatus='deployed'
        totalCount={countsQuery.data.data?.deployed_count ?? 0}
        organizationId={resolvedContext === 'my-org-projects' ? orgUid : undefined}
        projectViewUid={resolvedContext === 'custom-view-projects' ? resolvedCustomViewUid : undefined}
      />

      <SidebarFormsListCategory
        context={resolvedContext}
        deploymentStatus='draft'
        totalCount={countsQuery.data.data?.draft_count ?? 0}
        organizationId={resolvedContext === 'my-org-projects' ? orgUid : undefined}
        projectViewUid={resolvedContext === 'custom-view-projects' ? resolvedCustomViewUid : undefined}
      />

      <SidebarFormsListCategory
        context={resolvedContext}
        deploymentStatus='archived'
        totalCount={countsQuery.data.data?.archived_count ?? 0}
        organizationId={resolvedContext === 'my-org-projects' ? orgUid : undefined}
        projectViewUid={resolvedContext === 'custom-view-projects' ? resolvedCustomViewUid : undefined}
      />
    </Stack>
  )
}
