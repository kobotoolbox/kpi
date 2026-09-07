import type { AccountResponse } from '#/dataInterface'
import type { EnvStoreData, SocialApp } from '#/envStore'
import sessionStore from '#/stores/session'

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
 * SSO accounts connected to the current user. It's at most one, but the endpoint gives us a list.
 */
export function getConnectedSsoAccounts() {
  return 'social_accounts' in sessionStore.currentAccount ? sessionStore.currentAccount.social_accounts : []
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
