import { useQueryClient } from '@tanstack/react-query'
import cx from 'classnames'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import securityStyles from '#/account/security/securityRoute.module.scss'
import type { ProviderAccount } from '#/api/models/providerAccount'
import {
  getAllauthBrowserV1AccountProvidersGetQueryKey,
  useAllauthBrowserV1AccountProvidersDelete,
  useAllauthBrowserV1AccountProvidersGet,
} from '#/api/react-query/authentication-allauth-headless'
import { getProviderRedirectId, readProviderRedirectError } from '#/auth/ProviderRoute/providerRedirect'
import { splitAllauthErrors } from '#/auth/allauthErrors'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import envStore, { type SocialApp } from '#/envStore'
import { useProfile } from '#/stores/useProfile'
import { notify } from '#/utils'
import ManagedSsoConfirmModal from './ManagedSsoConfirmModal'
import SsoConnectButton from './SsoConnectButton'
import { findAppForProviderAccount, getSsoConnectErrorMessage, getSsoProviders, isSsoAvailable } from './sso.utils'
import styles from './ssoSection.module.scss'

/**
 * The `?error=` a failed handshake came back with, read once and then cleared. `window.location.search` survives hash
 * navigation, so leaving it would re-announce the same failure on every later visit to this screen.
 */
function useConsumedRedirectError(): string | null {
  const { search } = useLocation()
  const [code] = useState(() => readProviderRedirectError(window.location.search, search))

  useEffect(() => {
    if (!code) {
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.delete('error')
    // allauth writes this one alongside. Nothing reads it, and it would otherwise follow the user around.
    url.searchParams.delete('error_process')
    window.history.replaceState(window.history.state, '', url)
  }, [code])

  return code
}

/**
 * Single sign-on on the security settings: what the account is connected to, and the way in or out.
 *
 * Two sources, because neither has all of it - allauth owns the connection, `/environment` owns the provider
 * list and the `managed` flag. allauth can link several providers at once, but KPI allows one, so this screen
 * talks about a single connection throughout.
 */
export default function SsoSection() {
  const { refreshAccount } = useProfile()
  const queryClient = useQueryClient()

  const socialApps = getSsoProviders(envStore.data)
  const [pendingManagedAppConfirm, setPendingManagedAppConfirm] = useState<SocialApp | null>(null)
  const redirectErrorCode = useConsumedRedirectError()

  const providersQuery = useAllauthBrowserV1AccountProvidersGet()
  // Three `data` deep: orval's wrapper, then allauth's envelope, then the list of connections.
  const connectedAccount = providersQuery.data?.status === 200 ? providersQuery.data.data.data[0] : undefined
  const connectedApp = connectedAccount ? findAppForProviderAccount(envStore.data, connectedAccount) : undefined
  const isManaged = connectedApp?.managed ?? false

  const disconnectProvider = useAllauthBrowserV1AccountProvidersDelete()

  function disconnectSocialAccount(account: ProviderAccount) {
    disconnectProvider.mutate(
      { data: { provider: account.provider.id, account: account.uid } },
      {
        onSuccess: async (response) => {
          // `fetchAllauth` hands 4xx back as data, so a refusal lands here and not in `onError`. allauth
          // sends one when disconnecting would leave no way into the account - no password set, say.
          // TODO: DEV-1971 a 401 here is a reauthentication ask, not a refusal
          if (response.status !== 200) {
            notify.error(splitAllauthErrors(response, []).formErrors.join(' '))
            return
          }

          // `/me/` keeps its own copy of the connections, which the password and email sections read, so refresh both
          await queryClient.invalidateQueries({ queryKey: getAllauthBrowserV1AccountProvidersGetQueryKey() })
          refreshAccount()
        },
      },
    )
  }

  // Not gated on the lookup, so the section does not pop in late. With no providers configured and nothing connected
  // there is nothing to show at all.
  if (!isSsoAvailable(envStore.data) && !connectedAccount) {
    return <></>
  }

  const bodyClassName = cx(securityStyles.securitySectionBody, styles.body)

  return (
    <section className={securityStyles.securitySection}>
      <div className={securityStyles.securitySectionTitle}>
        <h2 className={securityStyles.securitySectionTitleText}>{t('Single-Sign On')}</h2>
      </div>

      <div className={bodyClassName}>
        {connectedAccount
          ? // allauth gives us the provider name, so even one kept off `/environment` gets named here.
            t('Connected to ##app_name##').replace('##app_name##', connectedAccount.provider.name)
          : t(
              'Connect your KoboToolbox account with an identity provider for single-sign on (SSO).' +
                ' This will also update your email address in case your current address is different.',
            )}
      </div>

      {redirectErrorCode && (
        <div className={bodyClassName}>
          <Alert type='error' iconName='alert'>
            {getSsoConnectErrorMessage(redirectErrorCode)}
          </Alert>
        </div>
      )}

      {connectedAccount ? (
        <div className={styles.options}>
          {!isManaged && (
            <ButtonNew
              variant='filled'
              loading={disconnectProvider.isPending}
              onClick={() => disconnectSocialAccount(connectedAccount)}
            >
              {t('Disable')}
            </ButtonNew>
          )}
        </div>
      ) : (
        <div className={cx(styles.options, styles.ssoSetup)}>
          {socialApps.map((socialApp) => {
            const providerId = getProviderRedirectId(socialApp)
            // A managed provider deletes the password on connecting, so that one asks before it starts.
            return socialApp.managed ? (
              <ButtonNew key={providerId} variant='filled' onClick={() => setPendingManagedAppConfirm(socialApp)}>
                {socialApp.name}
              </ButtonNew>
            ) : (
              <SsoConnectButton key={providerId} providerId={providerId} variant='filled'>
                {socialApp.name}
              </SsoConnectButton>
            )
          })}
        </div>
      )}

      {pendingManagedAppConfirm && (
        <ManagedSsoConfirmModal
          providerName={pendingManagedAppConfirm.name}
          providerId={getProviderRedirectId(pendingManagedAppConfirm)}
          onClose={() => setPendingManagedAppConfirm(null)}
        />
      )}
    </section>
  )
}
