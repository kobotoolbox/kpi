// Libraries
import React, {useCallback} from 'react';
import {observer} from 'mobx-react-lite';
import cx from 'classnames';

// Partial components
import Button from 'jsapp/js/components/common/button';

// Stores and utils
import sessionStore from 'js/stores/session';
import envStore, {type SocialApp} from 'jsapp/js/envStore';
import {deleteSocialAccount} from './sso.api';

// Styles
import styles from './ssoSection.module.scss';
import securityStyles from 'js/account/security/securityRoute.module.scss';

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
    if (socialApp.provider === 'openid_connect') {
      providerPath = 'oidc/' + socialApp.provider_id;
    } else {
      providerPath = socialApp.provider_id || socialApp.provider;
    }
    return `accounts/${providerPath}/login/?process=connect&next=%2F%23%2Faccount%2Fsecurity`;
  }, [sessionStore.currentAccount]);

  if (socialApps.length === 0 && socialAccounts.length === 0) {
    return <></>;
  }

  return (
    <section className={securityStyles.securitySection}>
      <div className={securityStyles.securitySectionTitle}>
        <h2 className={securityStyles.securitySectionTitleText}>{t('Single-Sign On')}</h2>
      </div>

      {socialAccounts.length === 0 ? (
        <div className={cx(securityStyles.securitySectionBody, styles.body)}>
          {t(
            "Connect your KoboToolbox account with your organization's identity provider for single-sign on (SSO). Afterwards, you will only " +
              'be able to sign in via SSO unless you disable this setting here. This will also update your email address in case your current ' +
              'address is different.'
          )}
        </div>
      ) : (
        <div className={cx(securityStyles.securitySectionBody, styles.body)}>
          {t('Already connected')}
        </div>
      )}

      {socialAccounts.length === 0 ? (
        <div className={cx(styles.options, styles.ssoSetup)}>
          {socialApps.map((socialApp) => (
            <a
              key={socialApp.name}
              href={providerLink(socialApp)}
            >
              <Button
                label={socialApp.name}
                size='m'
                type='primary'
                onClick={() => {
                  /*TODO: Handle NavLink and Button*/
                }}
              />
            </a>
          ))}
        </div>
      ) : (
        <div className={styles.options}>
          <Button
            label={t('Disable')}
            size='m'
            type='primary'
            onClick={disconnectSocialAccount}
          />
        </div>
      )}
    </section>
  );
});

export default SsoSection;
