import {
  getOrganizationsRetrieveQueryKey,
  useOrganizationsRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import {
  doesProfileDetailsRouteBlockerNeedOrganization,
  isProfileDetailsRouteBlockerActive,
} from '#/router/routerUtils'
import { useProfile } from '#/stores/useProfile'

export type ProfileDetailsBlockerState =
  | { status: 'inactive' }
  /**
   * Carries `is_mmo` so the form does not have to ask for the organization a second time. Reads `true` until the
   * organization answers, so its fields stay out of the form until they are known to be the user's to edit.
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
  const profile = useProfile()
  const account = profile.currentLoggedAccount
  const organizationId = 'email' in account ? account.organization?.uid : undefined

  // The widest reading, and the common answer by far: most people have their details filled in already.
  const isPossiblyActive = isProfileDetailsRouteBlockerActive()
  const needsOrganization = doesProfileDetailsRouteBlockerNeedOrganization()

  const organizationQuery = useOrganizationsRetrieve(organizationId!, {
    query: {
      // Every blocked account asks, even when the answer only decides which fields the form shows.
      enabled: isPossiblyActive && Boolean(organizationId),
      staleTime: Number.POSITIVE_INFINITY, // Same as `RequireOrg`, which is where the rest of the app gets it.
      queryKey: getOrganizationsRetrieveQueryKey(organizationId!), // Note: see Orval issue https://github.com/orval-labs/orval/issues/2396
      // No error toast: a failure either lands on `ProfileDetailsErrorScreen` or costs nothing but the
      // organization's own fields. `RequireOrg` swallows this query's errors too.
      throwOnError: () => false,
    },
  })
  const organization = organizationQuery.data?.status === 200 ? organizationQuery.data.data : undefined

  if (!isPossiblyActive) {
    return { status: 'inactive' }
  }

  // Nothing to wait for, and no organization to manage those fields.
  if (!organizationId) {
    return { status: 'active', isMmoMember: false }
  }

  // Everything missing is the user's own to fill in, so the organization cannot change this answer - the form goes
  // up without waiting, even if the request fails. Its fields do wait: a member who edits one gets the whole PATCH
  // rejected, while anybody else just sees them a moment late.
  if (!needsOrganization) {
    return { status: 'active', isMmoMember: organization ? Boolean(organization.is_mmo) : true }
  }

  if (organization) {
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
