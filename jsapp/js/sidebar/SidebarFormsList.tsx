import { Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import React, { useEffect } from 'react'
import { actions } from '#/actions'
import { invalidatePaginatedList } from '#/api/mutation-defaults/common'
import { getAssetsListQueryKey, useAssetsList } from '#/api/react-query/manage-projects-and-library-content'
import { COMMON_QUERIES } from '#/constants'
import { notify } from '#/utils'
import LoadingSpinner from '../components/common/loadingSpinner'
import SidebarFormsListCategory from './SidebarFormsListCategory'

export const SidebarFormsListQueryKey = getAssetsListQueryKey({ q: COMMON_QUERIES.s, limit: 200, ordering: 'name' })

/**
 * A list of projects grouped by status (deployed, draft, archived). It's meant to be displayed in the sidebar area.
 */
export default function SidebarFormsList() {
  const [isCategoryDeployedOpened, categoryDeployedHandlers] = useDisclosure(false)
  const [isCategoryDraftOpened, categoryDraftHandlers] = useDisclosure(false)
  const [isCategoryArchivedOpened, categoryArchivedHandlers] = useDisclosure(false)

  useEffect(() => {
    // TODO: when gradually switching to Orval for all these actions below, make sure to write invalidating code in
    // `jsapp/js/api/mutation-defaults`

    // This is a list of different Reflux actions that upon completion would cause changes to the list of assets in
    // SidebarFormsList
    const unlisteners = [
      actions.resources.deleteAsset.completed.listen(() => invalidatePaginatedList(SidebarFormsListQueryKey)),
      actions.resources.cloneAsset.completed.listen(() => invalidatePaginatedList(SidebarFormsListQueryKey)),
      actions.resources.deployAsset.completed.listen(() => invalidatePaginatedList(SidebarFormsListQueryKey)),
      actions.resources.setDeploymentActive.completed.listen(() => invalidatePaginatedList(SidebarFormsListQueryKey)),
      // A name could change
      actions.resources.updateAsset.completed.listen(() => invalidatePaginatedList(SidebarFormsListQueryKey)),
      // User could've removed themselves from a shared asset
      actions.permissions.removeAssetPermission.completed.listen(() =>
        invalidatePaginatedList(SidebarFormsListQueryKey),
      ),
    ]
    // When unmounting, let's remember to unlisten all those Reflux actions
    return () => {
      unlisteners.forEach((clb) => clb())
    }
  }, [])

  const assetsQuery = useAssetsList(
    {
      q: COMMON_QUERIES.s,
      // Old code used 200, as there is no pagination handling in this component. This requires some new design and
      // rethinking of whole component.
      limit: 200,
    },
    {
      query: {
        queryKey: SidebarFormsListQueryKey,
        throwOnError: () => {
          notify.error(t('There was an error getting the list.')) // TODO: get the message from backend
          return false
        },
      },
    },
  )

  if (assetsQuery.isLoading) {
    return <LoadingSpinner />
  }

  if (assetsQuery.data?.status !== 200) {
    return <Text>{t('Could not load assets')}</Text>
  }

  const deployedProjects =
    assetsQuery.data.data.results?.filter((asset) => asset.deployment_status === 'deployed') || []
  const draftProjects = assetsQuery.data.data.results?.filter((asset) => asset.deployment_status === 'draft') || []
  const archivedProjects =
    assetsQuery.data.data.results?.filter((asset) => asset.deployment_status === 'archived') || []

  return (
    // minHeight needed for flex to work properly with scrollable containers
    <Stack style={{ minHeight: 0 }}>
      <SidebarFormsListCategory
        onToggleClick={categoryDeployedHandlers.toggle}
        isOpen={isCategoryDeployedOpened}
        iconName={'deploy'}
        label={t('Deployed')}
        projects={deployedProjects}
      />

      <SidebarFormsListCategory
        onToggleClick={categoryDraftHandlers.toggle}
        isOpen={isCategoryDraftOpened}
        iconName={'drafts'}
        label={t('Draft')}
        projects={draftProjects}
      />

      <SidebarFormsListCategory
        onToggleClick={categoryArchivedHandlers.toggle}
        isOpen={isCategoryArchivedOpened}
        iconName={'archived'}
        label={t('Archived')}
        projects={archivedProjects}
      />
    </Stack>
  )
}
