import { Tabs } from '@mantine/core'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import assetStore from '#/assetStore'
import { userCan, userCanPartially } from '#/components/permissions/utils'
import type { AssetResponse } from '#/dataInterface'
import { ROUTES } from '#/router/routerConstants'
import {
  getRouteAssetUid,
  isAnyFormDataRoute,
  isAnyFormSettingsRoute,
  isFormLandingRoute,
  isFormSummaryRoute,
} from '#/router/routerUtils'
import sessionStore from '#/stores/session'
import styles from './projectTopTabs.module.scss'

export default function ProjectTopTabs() {
  // First check if uid is available
  const assetUid = getRouteAssetUid()
  if (assetUid === null) {
    return null
  }

  const [asset, setAsset] = useState<AssetResponse | undefined>(undefined)
  const navigate = useNavigate()

  useEffect(() => {
    assetStore.whenLoaded(assetUid, setAsset)
  }, [])

  const isDataTabEnabled = userCan('view_submissions', asset) || userCanPartially('view_submissions', asset)

  const isSettingsTabEnabled =
    sessionStore.isLoggedIn && (userCan('change_asset', asset) || userCan('change_metadata_asset', asset))

  const summaryRoute = ROUTES.FORM_SUMMARY.replace(':uid', assetUid)
  const formRoute = ROUTES.FORM_LANDING.replace(':uid', assetUid)
  const dataRoute = ROUTES.FORM_DATA.replace(':uid', assetUid)
  const settingsRoute = ROUTES.FORM_SETTINGS.replace(':uid', assetUid)

  // Keep track of active tab via route to preserve back/forward browser navigation
  let activeTab: string | null = null
  if (isFormSummaryRoute(assetUid)) {
    activeTab = summaryRoute
  } else if (isFormLandingRoute(assetUid)) {
    activeTab = formRoute
  } else if (isAnyFormDataRoute(assetUid)) {
    activeTab = dataRoute
  } else if (isAnyFormSettingsRoute(assetUid)) {
    activeTab = settingsRoute
  }

  const handleTabChange = (route: string | null) => {
    if (route) {
      navigate(route)
    }
  }

  return (
    <nav className={styles.root}>
      <Tabs size='md' value={activeTab} onChange={handleTabChange} className={styles.tabs}>
        <Tabs.List justify='center'>
          <Tabs.Tab value={summaryRoute} disabled={!sessionStore.isLoggedIn}>
            {t('Summary')}
          </Tabs.Tab>
          <Tabs.Tab value={formRoute}>{t('Form')}</Tabs.Tab>
          <Tabs.Tab value={dataRoute} disabled={!isDataTabEnabled}>
            {t('Data')}
          </Tabs.Tab>
          <Tabs.Tab value={settingsRoute} disabled={!isSettingsTabEnabled}>
            {t('Settings')}
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
    </nav>
  )
}
