import React from 'react';
import {observer} from 'mobx-react-lite';
import sessionStore from 'js/stores/session';
import {PATHS} from 'js/router/routerConstants';
import styles from './ssoSection.module.scss';
import {deleteSocialAccount} from './sso.api';

const SsoSection = observer(() => {
  const socialAccounts =
    'social_accounts' in sessionStore.currentAccount
      ? sessionStore.currentAccount.social_accounts
      : [];

  const disconnectSocialAccount = () => {
    if (socialAccounts.length) {
      const socialAccount = socialAccounts[0];
      deleteSocialAccount(socialAccount.provider, socialAccount.uid).then(
        () => {
          sessionStore.refreshAccount();
        }
      );
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.securityRowHeader}>
        <h2 className={styles.title}>{t('Single-Sign On')}</h2>
      </div>
      {socialAccounts.length === 0 ? (
        <>
          <div className={styles.ssoSectionBody}>
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
          </div>
        </>
      ) : (
        <div>
          Already connected{' '}
          <button onClick={disconnectSocialAccount}>Disable</button>
        </div>
      )}
    </div>
  );
});

export default SsoSection;
