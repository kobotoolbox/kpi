import React, {useState} from 'react';
import sessionStore from 'js/stores/session';
import {PATHS} from 'js/router/routerConstants';
import styles from './ssoSection.module.scss';

export default function SsoSection() {
  const [session] = useState(() => sessionStore);
  const identities =
    'identities' in session.currentAccount
      ? session.currentAccount.identities
      : [];
  return (
    <div className={styles.root}>
      <div className={styles.securityRowHeader}>
        <h2>{t('Single-Sign On')}</h2>
      </div>
      {identities.length === 0 ? (
        <>
          <div className={styles.securityDescription}>
            {t(
              "Connect your KoboToolbox account with your organization's identity provider for single-sign on (SSO). Afterwards, you will only " +
                'be able to sign in via SSO unless you disable this setting here. This will also update your email address in case your current ' +
                'address is different.'
            )}
          </div>
          <div className={styles.securityButton}>
            <a
              href={
                PATHS.MS_SSO +
                '?process=connect&next=%2F%23%2Faccount%2Fsecurity'
              }
              className='kobo-button kobo-button--blue'
            >
              {t('Set up')}
            </a>
          </div>
        </>
      ) : (
        <div>Already connected</div>
      )}
    </div>
  );
}
