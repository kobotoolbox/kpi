import { Box, NavLink } from '@mantine/core'
import React from 'react'
import { Link, matchPath, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { getAssetsRetrieveQueryKey, useAssetsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
import type { AssetResponse } from '#/dataInterface'
import { ROUTES } from '#/router/routerConstants'
import { isPlainClick } from '#/utils'
import styles from './FormViewSideTabs.module.scss'
import { getSideMenu } from './FormViewSideTabs.utils'
import { useAssetRefluxInvalidation } from './useAssetRefluxInvalidation'

// No background in any state, so the active styles only change the colors. Inline, so Mantine's own CSS can't win.
const navLinkVars = () => ({ root: { '--nl-bg': 'transparent', '--nl-hover': 'transparent' }, children: {} })

/** Side menu for the project data and settings routes. Renders nothing elsewhere. */
export default function FormViewSideTabs() {
  const location = useLocation()
  const navigate = useNavigate()

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

  useAssetRefluxInvalidation(assetUid)

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
        const isActive = matchPath({ path: tab.path, end: !tab.matchesNestedRoutes }, location.pathname) !== null
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
            vars={navLinkVars}
            onClick={(evt) => {
              // Ctrl/Cmd/Shift-clicks still open the tab in a new tab or window
              if (isActive && isPlainClick(evt)) {
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
