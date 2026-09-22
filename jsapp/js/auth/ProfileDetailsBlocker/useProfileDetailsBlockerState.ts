import {
  getOrganizationsRetrieveQueryKey,
  useOrganizationsRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import {
  doesProfileDetailsRouteBlockerNeedOrganization,
  isProfileDetailsRouteBlockerActive,
} from '#/router/routerUtils'
import sessionStore from '#/stores/session'

export type ProfileDetailsBlockerState =
  | { status: 'inactive' }
  /**
   * Carries `is_mmo` so the form does not have to ask for the organization a second time.
   * It is also `true` when the organization was never asked for.
   */
  | { status: 'active'; isMmoMember: boolean }
  /** Waiting on the organization, without which there is no answer. */
  | { status: 'pending' }
  /** The organization could not be read, so there is no answer to give. */
  | { status: 'error' }

/**
 * Whether the required profile details have to block the app, which takes two passes: the account, and the organization
 * (see {@link isProfileDetailsRouteBlockerActive} why it matters).
 *
 * Reads the session store directly, so it has to be called from an `observer`.
 */
export function useProfileDetailsBlockerState(): ProfileDetailsBlockerState {
  const account = sessionStore.currentAccount
  const organizationId = 'email' in account ? account.organization?.uid : undefined

  // The widest reading, and the common answer by far: most people have their details filled in already.
  const isPossiblyActive = isProfileDetailsRouteBlockerActive()
  const needsOrganization = doesProfileDetailsRouteBlockerNeedOrganization()

  const organizationQuery = useOrganizationsRetrieve(organizationId!, {
    query: {
      // Nothing the organization owns is missing, so there is nothing to ask it about.
      enabled: needsOrganization && Boolean(organizationId),
      staleTime: Number.POSITIVE_INFINITY, // Same as `RequireOrg`, which is where the rest of the app gets it.
      queryKey: getOrganizationsRetrieveQueryKey(organizationId!), // Note: see Orval issue https://github.com/orval-labs/orval/issues/2396
    },
  })

  if (!isPossiblyActive) {
    return { status: 'inactive' }
  }

  if (!needsOrganization) {
    return { status: 'active', isMmoMember: true }
  }

  if (!organizationId) {
    return { status: 'active', isMmoMember: false }
  }

  if (organizationQuery.data?.status === 200) {
    const organization = organizationQuery.data.data
    const isMmoMember = Boolean(organization.is_mmo)
    // Asked again now that MMO status is known: it can take the organization's own fields out of the count.
    return isProfileDetailsRouteBlockerActive(organization) ? { status: 'active', isMmoMember } : { status: 'inactive' }
  }

  // Terminal, because React Query has used up its retries by now. A non-200 counts too: the endpoint answers
  // 404 for an organization the account has been moved out of.
  if (organizationQuery.isError || organizationQuery.data) {
    return { status: 'error' }
  }

  return { status: 'pending' }
}
