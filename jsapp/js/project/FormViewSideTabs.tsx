import { Box, NavLink } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import React, { useEffect } from 'react'
import { Link, matchPath, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { actions } from '#/actions'
import { invalidateItem } from '#/api/mutation-defaults/common'
import { getAssetsRetrieveQueryKey, useAssetsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse } from '#/dataInterface'
import { ROUTES } from '#/router/routerConstants'
import styles from './FormViewSideTabs.module.scss'

export interface FormViewSideTab {
  label: string
  icon: string
  path: string
  isDisabled?: boolean
}

/** Tabs for the project data routes. Also listed on the project summary page. */
export function getFormDataTabs(assetUid: string): FormViewSideTab[] {
  return [
    {
      label: t('Table'),
      icon: 'k-icon k-icon-table',
      path: ROUTES.FORM_TABLE.replace(':uid', assetUid),
    },
    {
      label: t('Reports'),
      icon: 'k-icon k-icon-reports',
      path: ROUTES.FORM_REPORT.replace(':uid', assetUid),
    },
    {
      label: t('Gallery'),
      icon: 'k-icon k-icon-gallery',
      path: ROUTES.FORM_GALLERY.replace(':uid', assetUid),
    },
    {
      label: t('Downloads'),
      icon: 'k-icon k-icon-download',
      path: ROUTES.FORM_DOWNLOADS.replace(':uid', assetUid),
    },
    {
      label: t('Map'),
      icon: 'k-icon k-icon-map-view',
      path: ROUTES.FORM_MAP.replace(':uid', assetUid),
    },
  ]
}

function getFormSettingsTabs(asset: AssetResponse): FormViewSideTab[] {
  const canChange = userCan(PERMISSIONS_CODENAMES.change_asset, asset)
  const canManage = userCan(PERMISSIONS_CODENAMES.manage_asset, asset)
  // REST services should be visible for archived forms but not drafts
  const hasEverBeenDeployed = asset.deployment__active || asset.deployed_versions.count > 0

  const tabs: FormViewSideTab[] = [
    {
      label: t('General'),
      icon: 'k-icon k-icon-settings',
      path: ROUTES.FORM_SETTINGS.replace(':uid', asset.uid),
    },
  ]

  if (canChange) {
    tabs.push({
      label: t('Media'),
      icon: 'k-icon k-icon-gallery',
      path: ROUTES.FORM_MEDIA.replace(':uid', asset.uid),
    })
  }

  if (canManage) {
    tabs.push(
      {
        label: t('Sharing'),
        icon: 'k-icon k-icon-user-share',
        path: ROUTES.FORM_SHARING.replace(':uid', asset.uid),
      },
      {
        label: t('Connect Projects'),
        icon: 'k-icon k-icon-attach',
        path: ROUTES.FORM_RECORDS.replace(':uid', asset.uid),
      },
    )
  }

  if (hasEverBeenDeployed && canChange && userCan(PERMISSIONS_CODENAMES.view_submissions, asset)) {
    tabs.push({
      label: t('REST Services'),
      icon: 'k-icon k-icon-data-sync',
      path: ROUTES.FORM_REST.replace(':uid', asset.uid),
    })
  }

  if (canManage) {
    tabs.push({
      label: t('Activity'),
      icon: 'k-icon k-icon-document',
      path: ROUTES.FORM_ACTIVITY.replace(':uid', asset.uid),
    })
  }

  return tabs
}

function getSideTabs(asset: AssetResponse, pathname: string): FormViewSideTab[] {
  if (matchPath({ path: ROUTES.FORM_SETTINGS, end: false }, pathname)) {
    return getFormSettingsTabs(asset)
  }
  if (asset.has_deployment && matchPath({ path: ROUTES.FORM_DATA, end: false }, pathname)) {
    return getFormDataTabs(asset.uid)
  }
  return []
}

/** Side menu for the project data and settings routes. Renders nothing elsewhere. */
export default function FormViewSideTabs() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Any project route, not just data and settings, so the query doesn't refetch every time the tabs reappear
  const assetUid = useMatch({ path: ROUTES.FORM, end: false })?.params.uid

  const assetQuery = useAssetsRetrieve(assetUid ?? '', undefined, {
    query: {
      queryKey: getAssetsRetrieveQueryKey(assetUid ?? ''),
      enabled: Boolean(assetUid),
      // The page next to the tabs already reports a failed asset load
      throwOnError: () => false,
    },
  })

  useEffect(() => {
    if (!assetUid) {
      return
    }
    // These mutations still go through Reflux, so nothing invalidates the query for us.
    // TODO: when switching these to Orval, move the invalidation to `jsapp/js/api/mutation-defaults`.
    const invalidateAsset = () => invalidateItem(getAssetsRetrieveQueryKey(assetUid), queryClient)
    const unlisteners = [
      actions.resources.deployAsset.completed.listen(invalidateAsset),
      actions.resources.setDeploymentActive.completed.listen(invalidateAsset),
      actions.permissions.assignAssetPermission.completed.listen(invalidateAsset),
      actions.permissions.removeAssetPermission.completed.listen(invalidateAsset),
      actions.permissions.bulkSetAssetPermissions.completed.listen(invalidateAsset),
      actions.permissions.copyPermissionsFrom.completed.listen(invalidateAsset),
    ]
    return () => {
      unlisteners.forEach((clb) => clb())
    }
  }, [assetUid, queryClient])

  if (assetQuery.data?.status !== 200) {
    return null
  }

  // TODO: stop casting this as AssetResponse after backend openAPI task DEV-1727 is done
  const asset = assetQuery.data.data as unknown as AssetResponse
  const tabs = getSideTabs(asset, location.pathname)

  if (tabs.length === 0) {
    return null
  }

  /** Remounts the current page by going through the `FORM_RESET` route and back. */
  function refreshTab(path: string) {
    navigate(ROUTES.FORM_RESET.replace(':uid', asset.uid))
    window.setTimeout(() => navigate(path), 50)
  }

  return (
    // Global styles use this class to size the page next to the tabs (`.form-view__sidetabs + .form-view` etc.)
    <Box component='nav' className='form-view__sidetabs'>
      {tabs.map((tab) => {
        const isActive = matchPath({ path: tab.path, end: true }, location.pathname) !== null
        return (
          <NavLink
            key={tab.path}
            component={Link}
            to={tab.path}
            label={tab.label}
            leftSection={<i className={tab.icon} />}
            active={isActive}
            aria-current={isActive ? 'page' : undefined}
            disabled={tab.isDisabled}
            classNames={{ root: styles.tab, section: styles.tabIcon, label: styles.tabLabel }}
            onClick={(evt) => {
              if (isActive) {
                evt.preventDefault()
                refreshTab(tab.path)
              }
            }}
          />
        )
      })}
    </Box>
  )
}
