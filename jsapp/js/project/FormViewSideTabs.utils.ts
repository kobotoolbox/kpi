import { matchPath } from 'react-router-dom'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse } from '#/dataInterface'
import { ROUTES } from '#/router/routerConstants'

interface FormViewSideTab {
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

/** The menu label (for the `nav` landmark) and its tabs, or `null` outside the data and settings routes. */
export function getSideMenu(asset: AssetResponse, pathname: string): { label: string; tabs: FormViewSideTab[] } | null {
  if (matchPath({ path: ROUTES.FORM_SETTINGS, end: false }, pathname)) {
    return { label: t('Settings'), tabs: getFormSettingsTabs(asset) }
  }
  if (asset.has_deployment && matchPath({ path: ROUTES.FORM_DATA, end: false }, pathname)) {
    return { label: t('Data'), tabs: getFormDataTabs(asset.uid) }
  }
  return null
}
