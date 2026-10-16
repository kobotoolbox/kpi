import type { ProviderAccount } from '#/api/models/providerAccount'
import { PROVIDER_ERROR_CODES, getProviderRedirectErrorMessage } from '#/auth/ProviderRoute/providerRedirect'
import type { AccountResponse } from '#/dataInterface'
import type { EnvStoreData, SocialApp } from '#/envStore'

/** The SSO providers configured on this server. */
export function getSsoProviders(envStoreData: EnvStoreData) {
  return envStoreData.social_apps
}

/**
 * Whether this server has any SSO provider configured, i.e. whether SSO is something users here can use at all.
 */
export function isSsoAvailable(envStoreData: EnvStoreData) {
  return getSsoProviders(envStoreData).length > 0
}

/**
 * Returns the SocialApp config for the user's connected SSO account, if any.
 * allauth stores SocialApp.provider_id as SocialAccount.provider, so we match on that.
 */
export function getConnectedApp(envStoreData: EnvStoreData, account: AccountResponse): SocialApp | undefined {
  const connectedAccount = 'social_accounts' in account ? account.social_accounts[0] : undefined
  if (!connectedAccount) {
    return undefined
  }
  return getSsoProviders(envStoreData).find((app) => app.provider_id === connectedAccount.provider)
}

/**
 * The same match as {@link getConnectedApp}, against what allauth reports rather than what `/me/` does.
 *
 * `undefined` for a provider configured `is_public=False`: `/environment` leaves those out, so there is a
 * connection to name but no config to go with it.
 */
export function findAppForProviderAccount(
  envStoreData: EnvStoreData,
  providerAccount: ProviderAccount,
): SocialApp | undefined {
  return getSsoProviders(envStoreData).find((app) => app.provider_id === providerAccount.provider.id)
}

/**
 * allauth's codes for a disconnect it refuses - both mean this is the only way left into the account. Its third,
 * `disconnect_last`, needs `SOCIALACCOUNT_ONLY`, which KPI does not set.
 */
const DISCONNECT_ERROR_CODES = {
  noPassword: 'no_password',
  noVerifiedEmail: 'no_verified_email',
} as const

/**
 * What to show when a disconnect is refused or fails. allauth's own message only states the problem, these say what
 * to do about it.
 */
export function getSsoDisconnectErrorMessage(code: string | undefined): string {
  if (code === DISCONNECT_ERROR_CODES.noPassword) {
    return t(
      'Set a password in the Password section above first.' +
        ' Your account needs another way to log in before single-sign on (SSO) can be disabled.',
    )
  }
  if (code === DISCONNECT_ERROR_CODES.noVerifiedEmail) {
    return t(
      'Confirm your email address in the Email address section above first,' +
        ' so that you can still reset your password once single-sign on (SSO) is disabled.',
    )
  }
  return t('We could not disable single-sign on (SSO) for your account. Please try again.')
}

/** KPI's own connect refusal, from `SocialAccountAdapter.pre_social_login`: one SSO connection per account. */
const CONNECT_ERROR_CODES = {
  multipleSsoNotAllowed: 'multiple_sso_not_allowed',
} as const

/** What to show for the `?error=` a failed `connect` comes back with */
export function getSsoConnectErrorMessage(code: string): string {
  if (code === PROVIDER_ERROR_CODES.connectedOther) {
    return t(
      'That account is already connected to a different KoboToolbox account.' +
        ' Please disconnect it there first, or use a different one.',
    )
  }
  if (code === PROVIDER_ERROR_CODES.cancelled) {
    return t('Connecting was cancelled before it finished. You can try again.')
  }
  if (code === CONNECT_ERROR_CODES.multipleSsoNotAllowed) {
    return t(
      'You can only connect one single-sign on (SSO) account at a time.' +
        ' Disable the current one before connecting another.',
    )
  }
  // A refusal reads the same whoever made it, so borrow the login wording instead of restating it. No `denied` here:
  // only allauth's draugiem provider sends it, and a real provider refusal arrives as an unknown error.
  if (code === PROVIDER_ERROR_CODES.permissionDenied) {
    return getProviderRedirectErrorMessage(PROVIDER_ERROR_CODES.denied)
  }
  // TODO: DEV-1971 send the user through a reauthentication instead of asking them to sign in again.
  if (code === PROVIDER_ERROR_CODES.reauthenticationRequired) {
    return t('Please log in again before connecting single-sign on (SSO) to your account.')
  }
  return t('We could not connect your account to that provider. Please try again.')
}
