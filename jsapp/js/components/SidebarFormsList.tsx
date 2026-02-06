import { Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import React, { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { actions } from '#/actions'
import type { Asset } from '#/api/models/asset'
import { invalidateList } from '#/api/mutation-defaults/common'
import { getAssetsListQueryKey, useAssetsList } from '#/api/react-query/manage-projects-and-library-content'
import { COMMON_QUERIES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import type { IconName } from '#/k-icons'
import { getRouteAssetUid } from '#/router/routerUtils'
import { notify } from '#/utils'
import styles from './SidebarFormsList.module.scss'
import AssetName from './common/assetName'
import Badge from './common/badge'
import Icon from './common/icon'
import LoadingSpinner from './common/loadingSpinner'
import { userCan } from './permissions/utils'

const SidebarFormsListQueryKey = getAssetsListQueryKey({ q: COMMON_QUERIES.s, limit: 200, ordering: 'name' })

export default function SidebarFormsList() {
  const [isCategoryDeployedOpened, categoryDeployedHandlers] = useDisclosure(false)
  const [isCategoryDraftOpened, categoryDraftHandlers] = useDisclosure(false)
  const [isCategoryArchivedOpened, categoryArchivedHandlers] = useDisclosure(false)

  const unlisteners: Function[] = []
  useEffect(() => {
    unlisteners.push(
      // A list of different Reflux actions that upon completion would cause changes to the list of assets in SidebarFormsList
      actions.resources.deleteAsset.completed.listen(() => invalidateList(SidebarFormsListQueryKey)),
      actions.resources.cloneAsset.completed.listen(() => invalidateList(SidebarFormsListQueryKey)),
      actions.resources.deployAsset.completed.listen(() => invalidateList(SidebarFormsListQueryKey)),
      actions.resources.setDeploymentActive.completed.listen(() => invalidateList(SidebarFormsListQueryKey)),
      actions.resources.updateAsset.completed.listen(() => invalidateList(SidebarFormsListQueryKey)),
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
      ordering: 'name',
    },
    {
      query: {
        queryKey: SidebarFormsListQueryKey,
        throwOnError: () => {
          notify.error(t('There was an error getting the list.')) // TODO: update message in backend (DEV-????).
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

  function renderCategoryButton(options: {
    toggleFunction: () => void
    iconName: IconName
    label: string
    count: number
  }) {
    return (
      <UnstyledButton
        size='md'
        variant='transparent'
        onClick={options.toggleFunction}
        className={styles.categoryButton}
      >
        <Group gap='xs'>
          <Icon name={options.iconName} size='l' className={styles.categoryButtonIcon} />
          <div style={{ flex: 1 }}>{options.label}</div>
          <Badge label={options.count} color='light-storm' size='xs' />
        </Group>
      </UnstyledButton>
    )
  }

  function renderProject(assetOriginal: Asset) {
    // TODO: because of a bug in OpenAPI schema, we can't use `userCan` easily. We cast it here until it is fixed.
    // See: https://linear.app/kobotoolbox/issue/DEV-1727/
    const asset = assetOriginal as unknown as AssetResponse

    let href = `/forms/${asset.uid}`
    if (userCan('view_submissions', asset) && asset.has_deployment && asset.deployment__submission_count) {
      href = `/forms/${asset.uid}/summary`
    } else {
      href = `/forms/${asset.uid}/landing`
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
    <Stack mt='lg'>
      {renderCategoryButton({
        toggleFunction: categoryDeployedHandlers.toggle,
        iconName: 'deploy',
        label: t('Deployed'),
        count: deployedProjects.length,
      })}

      {isCategoryDeployedOpened && <Stack gap='0'>{deployedProjects.map(renderProject)}</Stack>}

      {renderCategoryButton({
        toggleFunction: categoryDraftHandlers.toggle,
        iconName: 'drafts',
        label: t('Draft'),
        count: draftProjects.length,
      })}

      {isCategoryDraftOpened && <Stack gap='0'>{draftProjects.map(renderProject)}</Stack>}

      {renderCategoryButton({
        toggleFunction: categoryArchivedHandlers.toggle,
        iconName: 'archived',
        label: t('Archived'),
        count: archivedProjects.length,
      })}

      {isCategoryArchivedOpened && <Stack gap='0'>{archivedProjects.map(renderProject)}</Stack>}
    </Stack>
  )
}
