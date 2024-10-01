import classnames from 'classnames';
import React, {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ROUTES} from 'js/router/routerConstants';
import {userCan, userCanPartially} from 'js/components/permissions/utils';
import {
  getRouteAssetUid,
  isAnyFormDataRoute,
  isFormLandingRoute,
  isAnyFormSettingsRoute,
  isFormSummaryRoute,
} from 'js/router/routerUtils';
import assetStore from 'js/assetStore';
import sessionStore from 'js/stores/session';
import type {AssetResponse} from 'js/dataInterface';
import styles from './projectTopTabs.module.scss';

export default function ProjectTopTabs() {
  // First check if uid is available
  const assetUid = getRouteAssetUid();
  if (assetUid === null) {
    return null;
  }

  // Setup navigation
  const navigate = useNavigate();

  const [asset, setAsset] = useState<AssetResponse | undefined>(undefined);

  useEffect(() => {
    assetStore.whenLoaded(assetUid, setAsset);
  }, []);

  const isDataTabEnabled =
    (userCan('view_submissions', asset) ||
      userCanPartially('view_submissions', asset));

  const isSettingsTabEnabled =
    sessionStore.isLoggedIn &&
    (userCan('change_asset', asset) || userCan('change_metadata_asset', asset));

  return (
    // TODO: this list needs to be keyboard-navigable. To make it so, we need
    // real `<button>`s here, not `<li>`s.
    <nav className={styles.root}>
      <ul className={styles.tabs}>
        <li
          onClick={() =>
            navigate(ROUTES.FORM_SUMMARY.replace(':uid', assetUid))
          }
          className={classnames({
            [styles.tab]: true,
            [styles.disabled]: !sessionStore.isLoggedIn,
            [styles.active]: isFormSummaryRoute(assetUid),
          })}
        >
          {t('Summary')}
        </li>

        <li
          onClick={() =>
            navigate(ROUTES.FORM_LANDING.replace(':uid', assetUid))
          }
          className={classnames({
            [styles.tab]: true,
            [styles.active]: isFormLandingRoute(assetUid),
          })}
        >
          {t('Form')}
        </li>

        <li
          onClick={() => navigate(ROUTES.FORM_DATA.replace(':uid', assetUid))}
          className={classnames({
            [styles.tab]: true,
            [styles.disabled]: !isDataTabEnabled,
            [styles.active]: isAnyFormDataRoute(assetUid),
          })}
        >
          {t('Data')}
        </li>

        <li
          onClick={() =>
            navigate(ROUTES.FORM_SETTINGS.replace(':uid', assetUid))
          }
          className={classnames({
            [styles.tab]: true,
            [styles.disabled]: !isSettingsTabEnabled,
            [styles.active]: isAnyFormSettingsRoute(assetUid),
          })}
        >
          {t('Settings')}
        </li>
      </ul>
    </nav>
  );
}
