import React, { useEffect, useState } from 'react'

import classnames from 'classnames'
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
  }, [])

  const isDataTabEnabled = userCan('view_submissions', asset) || userCanPartially('view_submissions', asset)

  const isSettingsTabEnabled =
    sessionStore.isLoggedIn && (userCan('change_asset', asset) || userCan('change_metadata_asset', asset))

  const summaryRoute = ROUTES.FORM_SUMMARY.replace(':uid', assetUid)
  const formRoute = ROUTES.FORM_LANDING.replace(':uid', assetUid)
  const dataRoute = ROUTES.FORM_DATA.replace(':uid', assetUid)
  const settingsRoute = ROUTES.FORM_SETTINGS.replace(':uid', assetUid)

  return (
    <nav className={styles.root}>
      <ul className={styles.tabs}>
        <li>
          {sessionStore.isLoggedIn ? (
            <Link
              to={summaryRoute}
              className={classnames(styles.tab, {
                [styles.active]: isFormSummaryRoute(assetUid),
              })}
            >
              {t('Summary')}
            </Link>
          ) : (
            <span
              className={classnames(styles.tab, styles.disabled, {
                [styles.active]: isFormSummaryRoute(assetUid),
              })}
            >
              {t('Summary')}
            </span>
          )}
        </li>

        <li>
          <Link
            to={formRoute}
            className={classnames(styles.tab, {
              [styles.active]: isFormLandingRoute(assetUid),
            })}
          >
            {t('Form')}
          </Link>
        </li>

        <li>
          {isDataTabEnabled ? (
            <Link
              to={dataRoute}
              className={classnames(styles.tab, {
                [styles.active]: isAnyFormDataRoute(assetUid),
              })}
            >
              {t('Data')}
            </Link>
          ) : (
            <span
              className={classnames(styles.tab, styles.disabled, {
                [styles.active]: isAnyFormDataRoute(assetUid),
              })}
            >
              {t('Data')}
            </span>
          )}
        </li>

        <li>
          {isSettingsTabEnabled ? (
            <Link
              to={settingsRoute}
              className={classnames(styles.tab, {
                [styles.active]: isAnyFormSettingsRoute(assetUid),
              })}
            >
              {t('Settings')}
            </Link>
          ) : (
            <span
              className={classnames(styles.tab, styles.disabled, {
                [styles.active]: isAnyFormSettingsRoute(assetUid),
              })}
            >
              {t('Settings')}
            </span>
          )}
        </li>
      </ul>
    </nav>
  )
}
