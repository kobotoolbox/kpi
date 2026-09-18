import {
  getOrganizationsRetrieveQueryKey,
  useOrganizationsRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import { isProfileDetailsRouteBlockerActive } from '#/router/routerUtils'
import sessionStore from '#/stores/session'

/**
 * Whether the required profile details have to block the app, which takes two passes: the cheap reading of
 * the account on its own, and - only when that one says something is missing - the exact one that knows the
 * organization. See {@link isProfileDetailsRouteBlockerActive} for why the organization matters.
 *
 * `undefined` means "not settled yet": the organization request is still on its way, or it failed. Waiting
 * it out is what `RequireOrg` does everywhere else in the app.
 *
 * Reads the session store directly, so it has to be called from an `observer`.
 */
export function useIsProfileDetailsBlockerActive(): boolean | undefined {
  const account = sessionStore.currentAccount
  const organizationId = 'email' in account ? account.organization?.uid : undefined

  // The widest reading, and the common answer by far: most people have their details filled in already.
  const isPossiblyActive = isProfileDetailsRouteBlockerActive()

  const organizationQuery = useOrganizationsRetrieve(organizationId!, {
    query: {
      // Nothing missing means nothing to ask the organization about, so the request never goes out.
      enabled: isPossiblyActive && Boolean(organizationId),
      staleTime: Number.POSITIVE_INFINITY, // Same as `RequireOrg`, which is where the rest of the app gets it.
      queryKey: getOrganizationsRetrieveQueryKey(organizationId!), // Note: see Orval issue https://github.com/orval-labs/orval/issues/2396
    },
  })

  if (!isPossiblyActive) {
    return false
  }

  // No organization, so no request went out and there is nothing to refine: for somebody who is not in one,
  // the reading above is already the exact one.
  if (!organizationId) {
    return true
  }

  if (organizationQuery.data?.status !== 200) {
    return undefined
  }

  return isProfileDetailsRouteBlockerActive(organizationQuery.data.data)
}
