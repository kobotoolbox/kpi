import { Stack, Text } from '@mantine/core'
import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { actions } from '#/actions'
import { queryClient } from '#/api/queryClient'
import {
  getAssetsCountsRetrieveQueryKey,
  getAssetsMinimalListRetrieveQueryKey,
  useAssetsCountsRetrieve,
} from '#/api/react-query/manage-projects-and-library-content'
import {
  getOrganizationsAssetsCountsRetrieveQueryKey,
  getOrganizationsAssetsMinimalListRetrieveQueryKey,
  getProjectViewsAssetsCountsRetrieveQueryKey,
  getProjectViewsAssetsMinimalListRetrieveQueryKey,
  useOrganizationsAssetsCountsRetrieve,
  useProjectViewsAssetsCountsRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import { PROJECTS_ROUTES } from '#/router/routerConstants'
import { useSession } from '#/stores/useSession'
import LoadingSpinner from '../components/common/loadingSpinner'
import SidebarFormsListCategory from './SidebarFormsListCategory'
import type { SidebarContext } from './sidebar.types'

function resolveSidebarContext(currentPath: string): SidebarContext | undefined {
  if (currentPath === PROJECTS_ROUTES.MY_ORG_PROJECTS) {
    return 'my-org-projects'
  } else if (currentPath === PROJECTS_ROUTES.MY_PROJECTS) {
    return 'my-projects'
  } else if (currentPath.startsWith(PROJECTS_ROUTES.CUSTOM_VIEW.replace(':viewUid', ''))) {
    return 'custom-view-projects'
  }
  // Return undefined for other routes (like individual project pages)
  return undefined
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
  // Invalidate my-projects related queries
  queryClient.invalidateQueries({
    queryKey: getAssetsCountsRetrieveQueryKey(),
  })
  queryClient.invalidateQueries({
    queryKey: getAssetsMinimalListRetrieveQueryKey(),
    exact: false,
  })

  // Invalidate my-org-projects related queries
  if (orgUid) {
    queryClient.invalidateQueries({
      queryKey: getOrganizationsAssetsCountsRetrieveQueryKey(orgUid),
    })
    queryClient.invalidateQueries({
      queryKey: getOrganizationsAssetsMinimalListRetrieveQueryKey(orgUid),
      exact: false,
    })
  }

  // Invalidate custom-view-projects related queries
  if (customViewUid) {
    queryClient.invalidateQueries({
      queryKey: getProjectViewsAssetsCountsRetrieveQueryKey(customViewUid),
    })
    queryClient.invalidateQueries({
      queryKey: getProjectViewsAssetsMinimalListRetrieveQueryKey(customViewUid),
      exact: false,
    })
  }
}

/**
 * A list of projects grouped by status (deployed, draft, archived). It's meant to be displayed in the sidebar area.
 */
export default function SidebarFormsList() {
  const session = useSession()
  const orgUid = session.currentLoggedAccount?.organization?.uid
  const location = useLocation()
  const currentPath = location.pathname

  // Preserve sidebar context across navigation
  const [sidebarContext, setSidebarContext] = useState<SidebarContext>('my-projects')
  const [preservedCustomViewUid, setPreservedCustomViewUid] = useState<string | undefined>()

  // Update context and custom view UID only when on project-listing routes
  const resolvedContextFromPath = resolveSidebarContext(currentPath)
  const resolvedCustomViewUid = resolveCustomViewUid(currentPath)
  useEffect(() => {
    if (resolvedContextFromPath !== undefined) {
      setSidebarContext(resolvedContextFromPath)
    }
    if (resolvedCustomViewUid !== undefined) {
      setPreservedCustomViewUid(resolvedCustomViewUid)
    }
  }, [resolvedContextFromPath, resolvedCustomViewUid])

  // Always call all 3 hooks to avoid "more/fewer hooks than during previous render" errors
  const countsQueryMyProjects = useAssetsCountsRetrieve({
    query: {
      // TODO: this prop shouldn't be required, see https://github.com/orval-labs/orval/issues/2396
      queryKey: getAssetsCountsRetrieveQueryKey(),
      enabled: sidebarContext === 'my-projects',
    },
  })

  const countsQueryOrgProjects = useOrganizationsAssetsCountsRetrieve(orgUid ?? '', {
    query: {
      queryKey: getOrganizationsAssetsCountsRetrieveQueryKey(orgUid ?? ''),
      enabled: sidebarContext === 'my-org-projects' && !!orgUid,
    },
  })

  const countsQueryCustomView = useProjectViewsAssetsCountsRetrieve(preservedCustomViewUid ?? '', {
    query: {
      queryKey: getProjectViewsAssetsCountsRetrieveQueryKey(preservedCustomViewUid ?? ''),
      enabled: sidebarContext === 'custom-view-projects' && !!preservedCustomViewUid,
    },
  })

  // Pick the active hook based on context
  const countsQuery =
    sidebarContext === 'my-projects'
      ? countsQueryMyProjects
      : sidebarContext === 'my-org-projects'
        ? countsQueryOrgProjects
        : countsQueryCustomView

  useEffect(() => {
    const invalidateSidebar = () => invalidateSidebarQueries(orgUid, preservedCustomViewUid)
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
  }, [orgUid, preservedCustomViewUid])

  if (countsQuery.isLoading || countsQuery.isPending) {
    return <LoadingSpinner />
  }

  if (countsQuery.error || countsQuery.data?.status !== 200) {
    return <Text>{t('Could not load asset counts')}</Text>
  }

  return (
    // minHeight needed for flex to work properly with scrollable containers
    <Stack style={{ minHeight: 0 }}>
      <SidebarFormsListCategory
        context={sidebarContext}
        deploymentStatus='deployed'
        totalCount={countsQuery.data.data?.deployed_count ?? 0}
        organizationId={sidebarContext === 'my-org-projects' ? orgUid : undefined}
        projectViewUid={sidebarContext === 'custom-view-projects' ? preservedCustomViewUid : undefined}
      />

      <SidebarFormsListCategory
        context={sidebarContext}
        deploymentStatus='draft'
        totalCount={countsQuery.data.data?.draft_count ?? 0}
        organizationId={sidebarContext === 'my-org-projects' ? orgUid : undefined}
        projectViewUid={sidebarContext === 'custom-view-projects' ? preservedCustomViewUid : undefined}
      />

      <SidebarFormsListCategory
        context={sidebarContext}
        deploymentStatus='archived'
        totalCount={countsQuery.data.data?.archived_count ?? 0}
        organizationId={sidebarContext === 'my-org-projects' ? orgUid : undefined}
        projectViewUid={sidebarContext === 'custom-view-projects' ? preservedCustomViewUid : undefined}
      />
    </Stack>
  )
}
