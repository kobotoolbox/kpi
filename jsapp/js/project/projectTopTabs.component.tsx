import React, { useEffect, useState } from 'react'

import classnames from 'classnames'
import { Link, useLocation } from 'react-router-dom'
import assetStore from '#/assetStore'
import { userCan, userCanPartially } from '#/components/permissions/utils'
import type { AssetResponse } from '#/dataInterface'
import { ROUTES } from '#/router/routerConstants'
import { getRouteAssetUid } from '#/router/routerUtils'
import profileStore from '#/stores/profile'
import styles from './projectTopTabs.module.scss'

export default function ProjectTopTabs() {
  const location = useLocation()

  // First check if uid is available
  const assetUid = getRouteAssetUid()
  const [asset, setAsset] = useState<AssetResponse | undefined>(undefined)

  useEffect(() => {
    let active = true
    if (assetUid !== null) {
      assetStore.whenLoaded(assetUid, (loadedAsset) => {
        if (active) {
          setAsset(loadedAsset)
        }
      })
    }
    return () => {
      active = false
    }
  }, [assetUid])

  if (assetUid === null) {
    return null
  }

  const isDataTabEnabled = userCan('view_submissions', asset) || userCanPartially('view_submissions', asset)

  const isSettingsTabEnabled =
    profileStore.isLoggedIn && (userCan('change_asset', asset) || userCan('change_metadata_asset', asset))

  const summaryRoute = ROUTES.FORM_SUMMARY.replace(':uid', assetUid)
  const formRoute = ROUTES.FORM_LANDING.replace(':uid', assetUid)
  const dataRoute = ROUTES.FORM_DATA.replace(':uid', assetUid)
  const settingsRoute = ROUTES.FORM_SETTINGS.replace(':uid', assetUid)

  const pathname = location.pathname
  const isFormSummaryRoute = pathname === summaryRoute
  const isFormLandingRoute = pathname === formRoute
  const isAnyFormDataRoute = pathname === dataRoute || pathname.startsWith(dataRoute)
  const isAnyFormSettingsRoute = pathname === settingsRoute || pathname.startsWith(settingsRoute)

  return (
    <nav className={styles.root}>
      <ul className={styles.tabs}>
        <li>
          {profileStore.isLoggedIn ? (
            <Link
              to={summaryRoute}
              className={classnames(styles.tab, {
                [styles.active]: isFormSummaryRoute,
              })}
            >
              {t('Summary')}
            </Link>
          ) : (
            <span
              className={classnames(styles.tab, styles.disabled, {
                [styles.active]: isFormSummaryRoute,
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
              [styles.active]: isFormLandingRoute,
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
                [styles.active]: isAnyFormDataRoute,
              })}
            >
              {t('Data')}
            </Link>
          ) : (
            <span
              className={classnames(styles.tab, styles.disabled, {
                [styles.active]: isAnyFormDataRoute,
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
                [styles.active]: isAnyFormSettingsRoute,
              })}
            >
              {t('Settings')}
            </Link>
          ) : (
            <span
              className={classnames(styles.tab, styles.disabled, {
                [styles.active]: isAnyFormSettingsRoute,
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
