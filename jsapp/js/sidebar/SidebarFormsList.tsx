import { Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import React, { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { actions } from '#/actions'
import type { Asset } from '#/api/models/asset'
import { invalidatePaginatedList } from '#/api/mutation-defaults/common'
import { getAssetsListQueryKey, useAssetsList } from '#/api/react-query/manage-projects-and-library-content'
import { COMMON_QUERIES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import type { IconName } from '#/k-icons'
import { ROUTES } from '#/router/routerConstants'
import { getRouteAssetUid } from '#/router/routerUtils'
import { notify } from '#/utils'
import AssetName from '../components/common/assetName'
import Badge from '../components/common/badge'
import Icon from '../components/common/icon'
import LoadingSpinner from '../components/common/loadingSpinner'
import { userCan } from '../components/permissions/utils'
import styles from './SidebarFormsList.module.scss'

export const SidebarFormsListQueryKey = getAssetsListQueryKey({ q: COMMON_QUERIES.s, limit: 200, ordering: 'name' })

/**
 * A list of projects grouped by status (deployed, draft, archived). It's meant to be displayed in the sidebar area.
 */
export default function SidebarFormsList() {
  const [isCategoryDeployedOpened, categoryDeployedHandlers] = useDisclosure(false)
  const [isCategoryDraftOpened, categoryDraftHandlers] = useDisclosure(false)
  const [isCategoryArchivedOpened, categoryArchivedHandlers] = useDisclosure(false)

  const unlisteners: Function[] = []
  useEffect(() => {
    // TODO: when gradually switching to Orval for all these actions below, make sure to write invalidating code in
    // `jsapp/js/api/mutation-defaults`

    // This is a list of different Reflux actions that upon completion would cause changes to the list of assets in
    // SidebarFormsList
    unlisteners.push(
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
    )
    // When unmounting, let's remember to unlisten all those Reflux actions
    return () => {
      unlisteners.forEach((clb) => clb())
    }
  }, [])

  const assetsQuery = useAssetsList(
    {
      q: COMMON_QUERIES.s,
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
  const deployedProjects = useMemo(() => {
    return assetsQuery.data?.data?.results?.filter((asset) => asset.deployment_status === 'deployed') || []
  }, [assetsQuery.data])
  const draftProjects = useMemo(() => {
    return assetsQuery.data?.data?.results?.filter((asset) => asset.deployment_status === 'draft') || []
  }, [assetsQuery.data])
  const archivedProjects = useMemo(() => {
    return assetsQuery.data?.data?.results?.filter((asset) => asset.deployment_status === 'archived') || []
  }, [assetsQuery.data])

  function renderCategory(options: {
    toggleFunction: () => void
    isOpen: boolean
    iconName: IconName
    label: string
    categoryAssets: Asset[]
  }) {
    return (
      <>
        <UnstyledButton
          size='md'
          variant='transparent'
          onClick={options.toggleFunction}
          className={styles.categoryButton}
        >
          <Group gap='xs'>
            <Icon name={options.iconName} size='l' className={styles.categoryButtonIcon} />
            <div style={{ flex: 1 }}>{options.label}</div>
            <Badge label={options.categoryAssets.length} color='light-storm' size='xs' />
          </Group>
        </UnstyledButton>

        {options.isOpen && (
          <Stack className={styles.categoryList} gap='0'>
            {options.categoryAssets.map(renderProject)}
          </Stack>
        )}
      </>
    )
  }

  function renderProject(assetOriginal: Asset) {
    // TODO: because of a bug in OpenAPI schema, we can't use `userCan` easily. We cast it here until it is fixed.
    // See: https://linear.app/kobotoolbox/issue/DEV-1727/
    const asset = assetOriginal as unknown as AssetResponse

    let href = ROUTES.FORM.replace(':uid', asset.uid)
    if (userCan('view_submissions', asset) && asset.has_deployment && asset.deployment__submission_count) {
      href = ROUTES.FORM_SUMMARY.replace(':uid', asset.uid)
    } else {
      href = ROUTES.FORM_LANDING.replace(':uid', asset.uid)
    }

    const isActiveProject = asset.uid === getRouteAssetUid()

    return (
      <Link
        to={href}
        key={asset.uid}
        style={{ background: isActiveProject ? 'var(--mantine-color-gray-7)' : 'transparent' }}
        className={styles.projectLink}
      >
        <Text fz='12' p='3 6'>
          <AssetName asset={asset} />
        </Text>
      </Link>
    )
  }

  if (assetsQuery.isError) {
    return <Text>{t('Could not load assets')}</Text>
  }

  if (assetsQuery.isLoading) {
    return <LoadingSpinner />
  }

  return (
    // minHeight needed for flex to work properly with scrollable containers
    <Stack style={{ minHeight: 0 }}>
      {renderCategory({
        toggleFunction: categoryDeployedHandlers.toggle,
        isOpen: isCategoryDeployedOpened,
        iconName: 'deploy',
        label: t('Deployed'),
        categoryAssets: deployedProjects,
      })}

      {renderCategory({
        toggleFunction: categoryDraftHandlers.toggle,
        isOpen: isCategoryDraftOpened,
        iconName: 'drafts',
        label: t('Draft'),
        categoryAssets: draftProjects,
      })}

      {renderCategory({
        toggleFunction: categoryArchivedHandlers.toggle,
        isOpen: isCategoryArchivedOpened,
        iconName: 'archived',
        label: t('Archived'),
        categoryAssets: archivedProjects,
      })}
    </Stack>
  )
}
