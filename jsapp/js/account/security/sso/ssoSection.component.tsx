import { useQueryClient } from '@tanstack/react-query'
import cx from 'classnames'
import { type ReactNode, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import securityStyles from '#/account/security/securityRoute.module.scss'
import type { ProviderAccount } from '#/api/models/providerAccount'
import {
  getAllauthBrowserV1AccountProvidersGetQueryKey,
  useAllauthBrowserV1AccountProvidersDelete,
  useAllauthBrowserV1AccountProvidersGet,
} from '#/api/react-query/authentication-allauth-headless'
import { getProviderRedirectId, readProviderRedirectError } from '#/auth/ProviderRoute/providerRedirect'
import { getFirstAllauthErrorCode } from '#/auth/allauthErrors'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import LoadingSpinner from '#/components/common/loadingSpinner'
import envStore, { type SocialApp } from '#/envStore'
import { useProfile } from '#/stores/useProfile'
import ManagedSsoConfirmModal from './ManagedSsoConfirmModal'
import SsoConnectButton from './SsoConnectButton'
import {
  findAppForProviderAccount,
  getSsoConnectErrorMessage,
  getSsoDisconnectErrorMessage,
  getSsoProviders,
  isSsoAvailable,
} from './sso.utils'
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

/** The section's title bar, so each state below only has to say what goes under it. */
function SsoSectionFrame({ children }: { children: ReactNode }) {
  return (
    <section className={securityStyles.securitySection}>
      <div className={securityStyles.securitySectionTitle}>
        <h2 className={securityStyles.securitySectionTitleText}>{t('Single-Sign On')}</h2>
      </div>
      {children}
    </section>
  )
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
  // Three `data` deep: orval's wrapper, then allauth's envelope, then the list of connections. `undefined` until a
  // 200 says what they are, which is not the same thing as there being none.
  const connections = providersQuery.data?.status === 200 ? providersQuery.data.data.data : undefined
  // `fetchAllauth` only throws from 500 up, so a refusal below that arrives as a status to check instead.
  const hasLookupFailed =
    providersQuery.isError || (providersQuery.data !== undefined && providersQuery.data.status !== 200)

  const connectedAccount = connections?.[0]
  const connectedApp = connectedAccount ? findAppForProviderAccount(envStore.data, connectedAccount) : undefined
  const isManaged = connectedApp?.managed ?? false

  const disconnectProvider = useAllauthBrowserV1AccountProvidersDelete({
    mutation: {
      // Here rather than in `mutate()`, whose callbacks are dropped if the user leaves the screen mid-request.
      onSuccess: async (response) => {
        if (response.status !== 200) {
          return
        }
        // `/me/` keeps its own copy of the connections, which the password and email sections read, so refresh both
        await queryClient.invalidateQueries({ queryKey: getAllauthBrowserV1AccountProvidersGetQueryKey() })
        refreshAccount()
      },
    },
  })
  const [disconnectErrorMessage, setDisconnectErrorMessage] = useState<string | null>(null)

  function disconnectSocialAccount(account: ProviderAccount) {
    setDisconnectErrorMessage(null)

    disconnectProvider.mutate(
      { data: { provider: account.provider.id, account: account.uid } },
      {
        onSuccess: (response) => {
          // `fetchAllauth` hands 4xx back as data, so a refusal lands here, not in `onError`. allauth refuses
          // when disconnecting would leave no way into the account.
          // TODO: DEV-1971 a 401 here is a reauthentication ask, not a refusal
          if (response.status !== 200) {
            setDisconnectErrorMessage(getSsoDisconnectErrorMessage(getFirstAllauthErrorCode(response)))
          }
        },
        // Only a 5xx gets here, and it says nothing useful.
        onError: () => setDisconnectErrorMessage(getSsoDisconnectErrorMessage(undefined)),
      },
    )
  }

  // With no providers configured there is nothing to offer, and the only connection left to report would be to one
  // kept off `/environment` - so this stays empty rather than flashing a spinner at everybody else.
  if (!isSsoAvailable(envStore.data) && !connectedAccount) {
    return <></>
  }

  const bodyClassName = cx(securityStyles.securitySectionBody, styles.body)

  // Offering a connection to somebody who has one, or hiding the way out of one, are both worse than waiting.
  if (!hasLookupFailed && connections === undefined) {
    return (
      <SsoSectionFrame>
        <div className={bodyClassName}>
          <LoadingSpinner message={false} />
        </div>
      </SsoSectionFrame>
    )
  }

  if (hasLookupFailed) {
    return (
      <SsoSectionFrame>
        <div className={bodyClassName}>
          <Alert type='error' iconName='alert'>
            {t('We could not check whether your account is connected for single-sign on (SSO).')}
          </Alert>
        </div>

        <div className={styles.options}>
          <ButtonNew variant='filled' loading={providersQuery.isFetching} onClick={() => providersQuery.refetch()}>
            {t('Try again')}
          </ButtonNew>
        </div>
      </SsoSectionFrame>
    )
  }

  // The disconnect failure wins: the redirect error is from an older handshake.
  const errorMessage =
    disconnectErrorMessage ?? (redirectErrorCode ? getSsoConnectErrorMessage(redirectErrorCode) : null)

  return (
    <SsoSectionFrame>
      <div className={bodyClassName}>
        {connectedAccount
          ? // allauth gives us the provider name, so even one kept off `/environment` gets named here.
            t('Connected to ##app_name##').replace('##app_name##', connectedAccount.provider.name)
          : t(
              'Connect your KoboToolbox account with an identity provider for single-sign on (SSO).' +
                ' This will also update your email address in case your current address is different.',
            )}
      </div>

      {errorMessage && (
        <div className={bodyClassName}>
          <Alert type='error' iconName='alert'>
            {errorMessage}
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
    </SsoSectionFrame>
  )
}
