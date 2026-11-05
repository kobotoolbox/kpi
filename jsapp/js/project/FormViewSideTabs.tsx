import { Box, NavLink } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import React, { useEffect } from 'react'
import { Link, matchPath, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { actions } from '#/actions'
import { invalidateItem } from '#/api/mutation-defaults/common'
import { getAssetsRetrieveQueryKey, useAssetsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
import type { AssetResponse } from '#/dataInterface'
import { ROUTES } from '#/router/routerConstants'
import styles from './FormViewSideTabs.module.scss'
import { getSideMenu } from './FormViewSideTabs.utils'

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
  const menu = getSideMenu(asset, location.pathname)

  if (!menu) {
    return null
  }

  /** Remounts the current page by going through the `FORM_RESET` route and back. */
  function refreshTab(path: string) {
    navigate(ROUTES.FORM_RESET.replace(':uid', asset.uid))
    window.setTimeout(() => navigate(path), 50)
  }

  return (
    <Box component='nav' aria-label={menu.label} className={styles.root}>
      {menu.tabs.map((tab) => {
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
