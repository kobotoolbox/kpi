import React, { useCallback } from 'react'

import cx from 'classnames'
import securityStyles from '#/account/security/securityRoute.module.scss'
import Button from '#/components/common/button'
import envStore, { type SocialApp } from '#/envStore'
import { useSession } from '#/stores/useSession'
import { deleteSocialAccount } from './sso.api'
import { getConnectedApp, getSsoProviders, isSsoAvailable } from './sso.utils'
import styles from './ssoSection.module.scss'

export default function SsoSection() {
  const { currentLoggedAccount, refreshAccount } = useSession()
  const socialApps = getSsoProviders(envStore.data)
  const connectedApp = getConnectedApp(envStore.data, currentLoggedAccount)
  const isManaged = connectedApp?.managed ?? false

  const connectedAccount =
    'social_accounts' in currentLoggedAccount ? currentLoggedAccount.social_accounts[0] : undefined

  const disconnectSocialAccount = () => {
    if (connectedAccount) {
      deleteSocialAccount(connectedAccount.provider, connectedAccount.uid).then(refreshAccount)
    }
  }

  const providerLink = useCallback(
    (socialApp: SocialApp) => {
      let providerPath = ''
      if (socialApp.provider === 'openid_connect') {
        providerPath = 'oidc/' + socialApp.provider_id
      } else {
        providerPath = socialApp.provider_id || socialApp.provider
      }
      return `accounts/${providerPath}/login/?process=connect&next=%2F%23%2Faccount%2Fsecurity`
    },
    [currentLoggedAccount],
  )

  if (!isSsoAvailable(envStore.data) && !connectedAccount) {
    return <></>
  }

  return (
    <section className={securityStyles.securitySection}>
      <div className={securityStyles.securitySectionTitle}>
        <h2 className={securityStyles.securitySectionTitleText}>{t('Single-Sign On')}</h2>
      </div>

      {connectedAccount ? (
        <div className={cx(securityStyles.securitySectionBody, styles.body)}>
          {connectedApp
            ? t('Connected to ##app_name##').replace('##app_name##', connectedApp.name)
            : t('Already connected')}
        </div>
      ) : (
        <div className={cx(securityStyles.securitySectionBody, styles.body)}>
          {t(
            "Connect your KoboToolbox account with your organization's identity provider for single-sign on (SSO). Afterwards, you will only " +
              'be able to sign in via SSO unless you disable this setting here. This will also update your email address in case your current ' +
              'address is different.',
          )}
        </div>
      )}

      {connectedAccount ? (
        <div className={styles.options}>
          {!isManaged && <Button label={t('Disable')} size='m' type='primary' onClick={disconnectSocialAccount} />}
        </div>
      ) : (
        <div className={cx(styles.options, styles.ssoSetup)}>
          {socialApps.map((socialApp) => (
            <a key={socialApp.name} href={providerLink(socialApp)}>
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
      )}
    </section>
  )
}
