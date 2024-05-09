import React, {useCallback} from 'react';
import {observer} from 'mobx-react-lite';
import sessionStore from 'js/stores/session';
import styles from './ssoSection.module.scss';
import {deleteSocialAccount} from './sso.api';
import Button from 'jsapp/js/components/common/button';
import envStore, {SocialApp} from 'jsapp/js/envStore';
import classNames from 'classnames';

const SsoSection = observer(() => {
  const socialApps = envStore.isReady ? envStore.data.social_apps : [];
  const socialAccounts =
    'social_accounts' in sessionStore.currentAccount
      ? sessionStore.currentAccount.social_accounts
      : [];

  const disconnectSocialAccount = () => {
    if (socialAccounts.length) {
      const socialAccount = socialAccounts[0];
      deleteSocialAccount(socialAccount.provider, socialAccount.uid).then(
        sessionStore.refreshAccount.bind(sessionStore)
      );
    }
  };

  const providerLink = useCallback((socialApp: SocialApp) => {
    let providerPath = '';
    if(socialApp.provider === 'openid_connect') {
      providerPath = 'oidc/' + socialApp.provider_id;
    } else {
      providerPath = socialApp.provider_id || socialApp.provider;
    }
    return `accounts/${providerPath}/login/?process=connect&next=%2F%23%2Faccount%2Fsecurity`;
  }, [sessionStore.currentAccount])

  if (socialApps.length === 0 && socialAccounts.length === 0) {
    return <></>;
  }

  return (
    <div className={styles.root}>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>{t('Single-Sign On')}</h2>
      </div>
      {socialAccounts.length === 0 ? (
        <div className={styles.bodySection}>
          <div className={styles.securityDescription}>
            {t(
              "Connect your KoboToolbox account with your organization's identity provider for single-sign on (SSO). Afterwards, you will only " +
                'be able to sign in via SSO unless you disable this setting here. This will also update your email address in case your current ' +
                'address is different.'
            )}
          </div>
        </div>
      ) : (
        <div className={styles.bodySection}>{t('Already connected')}</div>
      )}

      {socialAccounts.length === 0 ? (
        <div className={classNames(styles.optionsSection, styles.ssoSetup)}>
          {socialApps.map((socialApp) => (
            <a
              href={providerLink(socialApp)}
              className={styles.passwordLink}
            >
              <Button
                label={socialApp.name}
                size='m'
                color='blue'
                type='frame'
                onClick={() => {
                  /*TODO: Handle NavLink and Button*/
                }}
              />
            </a>
          ))}
        </div>
      ) : (
        <div className={styles.optionsSection}>
          <Button
            label={t('Disable')}
            size='m'
            color='blue'
            type='frame'
            onClick={disconnectSocialAccount}
          />
        </div>
      )}
    </div>
  );
});

export default SsoSection;
