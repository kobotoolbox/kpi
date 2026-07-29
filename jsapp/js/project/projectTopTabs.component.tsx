import { Tabs } from '@mantine/core'
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

export default function ProjectTopTabs() {
  // First check if uid is available
  const assetUid = getRouteAssetUid()
  if (assetUid === null) {
    return null
  }

  const [asset, setAsset] = useState<AssetResponse | undefined>(undefined)

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

  // Keep track of active tab via route to sync selected tab with browser forward/back navigation
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

  return (
    <Tabs size='lg' value={activeTab}>
      <Tabs.List justify='center'>
        <Tabs.Tab
          value={summaryRoute}
          disabled={!sessionStore.isLoggedIn}
          renderRoot={(props) =>
            sessionStore.isLoggedIn ? <Link to={summaryRoute} {...props} /> : <span {...props} />
          }
        >
          {t('Summary')}
        </Tabs.Tab>
        <Tabs.Tab value={formRoute} renderRoot={(props) => <Link to={formRoute} {...props} />}>
          {t('Form')}
        </Tabs.Tab>
        <Tabs.Tab
          value={dataRoute}
          disabled={!isDataTabEnabled}
          renderRoot={(props) => (isDataTabEnabled ? <Link to={summaryRoute} {...props} /> : <span {...props} />)}
        >
          {t('Data')}
        </Tabs.Tab>
        <Tabs.Tab
          value={settingsRoute}
          disabled={!isSettingsTabEnabled}
          renderRoot={(props) => (isSettingsTabEnabled ? <Link to={summaryRoute} {...props} /> : <span {...props} />)}
        >
          {t('Settings')}
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  )
}
