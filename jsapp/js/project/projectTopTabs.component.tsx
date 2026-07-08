import React, { useEffect, useState } from 'react'

import { Tabs } from '@mantine/core'
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
import styles from './projectTopTabs.module.scss'

export default function ProjectTopTabs() {
  // First check if uid is available
  const assetUid = getRouteAssetUid()
  if (assetUid === null) {
    return null
  }

  const [asset, setAsset] = useState<AssetResponse | undefined>(undefined)

  useEffect(() => {
    assetStore.whenLoaded(assetUid, setAsset)
  }, [assetUid])

  const isDataTabEnabled = userCan('view_submissions', asset) || userCanPartially('view_submissions', asset)

  const isSettingsTabEnabled =
    sessionStore.isLoggedIn && (userCan('change_asset', asset) || userCan('change_metadata_asset', asset))

  const summaryRoute = ROUTES.FORM_SUMMARY.replace(':uid', assetUid)
  const formRoute = ROUTES.FORM_LANDING.replace(':uid', assetUid)
  const dataRoute = ROUTES.FORM_DATA.replace(':uid', assetUid)
  const settingsRoute = ROUTES.FORM_SETTINGS.replace(':uid', assetUid)

  let activeTab = 'form'
  if (isFormSummaryRoute(assetUid)) {
    activeTab = 'summary'
  } else if (isAnyFormDataRoute(assetUid)) {
    activeTab = 'data'
  } else if (isAnyFormSettingsRoute(assetUid)) {
    activeTab = 'settings'
  } else if (isFormLandingRoute(assetUid)) {
    activeTab = 'form'
  }

  return (
    <Tabs value={activeTab} className={styles.root}>
      <Tabs.List grow>
        {sessionStore.isLoggedIn ? (
          <Tabs.Tab value='summary' renderRoot={(props) => <Link {...props} to={summaryRoute} />}>
            {t('Summary')}
          </Tabs.Tab>
        ) : (
          <Tabs.Tab value='summary' disabled>
            {t('Summary')}
          </Tabs.Tab>
        )}

        <Tabs.Tab value='form' renderRoot={(props) => <Link {...props} to={formRoute} />}>
          {t('Form')}
        </Tabs.Tab>

        {isDataTabEnabled ? (
          <Tabs.Tab value='data' renderRoot={(props) => <Link {...props} to={dataRoute} />}>
            {t('Data')}
          </Tabs.Tab>
        ) : (
          <Tabs.Tab value='data' disabled>
            {t('Data')}
          </Tabs.Tab>
        )}

        {isSettingsTabEnabled ? (
          <Tabs.Tab value='settings' renderRoot={(props) => <Link {...props} to={settingsRoute} />}>
            {t('Settings')}
          </Tabs.Tab>
        ) : (
          <Tabs.Tab value='settings' disabled>
            {t('Settings')}
          </Tabs.Tab>
        )}
      </Tabs.List>
    </Tabs>
  )
}
