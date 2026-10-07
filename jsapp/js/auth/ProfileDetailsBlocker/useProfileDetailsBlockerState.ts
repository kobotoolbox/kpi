import type { AccountFieldsConfig } from '#/account/account.constants'
import { useAccountFieldsConfig } from '#/account/useAccountFieldsConfig'
import {
  getOrganizationsRetrieveQueryKey,
  useOrganizationsRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import { useProfile } from '#/stores/useProfile'
import { doBlankFieldsDependOnMmoStatus, getBlankRequiredProfileFieldNamesForAccount } from './profileDetails.utils'

export type ProfileDetailsBlockerState =
  | { status: 'inactive' }
  /**
   * Carries what the screen needs, so neither it nor the form has to ask for any of it a second time: `is_mmo`
   * decides which fields are the user's own to edit, and the configuration is what the fields are built from.
   */
  | { status: 'active'; isMmoMember: boolean; fieldsConfig: AccountFieldsConfig }
  /** Waiting on something without which there is no answer. */
  | { status: 'pending' }
  /** The organization could not be read, so there is no answer to give. */
  | { status: 'error' }

/**
 * Whether the required profile details have to block the app. This takes two passes - the account against what the
 * instance asks for, and then the organization, which can take fields out of the count that its members are not the
 * ones to fill in.
 */
export function useProfileDetailsBlockerState(): ProfileDetailsBlockerState {
  const { currentLoggedAccount } = useProfile()
  // `useProfile` types the anonymous placeholder it starts with as an account, and `email` is what tells the two
  // apart. Nobody signed in is nobody to block.
  const account = currentLoggedAccount && 'email' in currentLoggedAccount ? currentLoggedAccount : undefined

  const fieldsConfigQuery = useAccountFieldsConfig()
  const fieldsConfig = fieldsConfigQuery.data
  const organizationId = account?.organization?.uid

  // The widest reading, which is also the common answer by far: most people have their details filled in already.
  const widestBlankFieldNames = getBlankRequiredProfileFieldNamesForAccount({
    account,
    userMetadataFields: fieldsConfig?.userMetadataFields,
  })
  const isPossiblyActive = widestBlankFieldNames.length > 0
  const needsOrganization = doBlankFieldsDependOnMmoStatus(widestBlankFieldNames)

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

  // `/environment` is what says which fields are required at all, so there is no answer before it lands. Waiting
  // beats answering `inactive`, which would show the app for a moment and then take it away again.
  if (fieldsConfigQuery.isPending) {
    return { status: 'pending' }
  }

  // A failed `/environment` leaves nothing to ask of the account, so nobody gets blocked. No screen about it here:
  // the request has raised its own toast, and `AppGuard` holds the whole app back until `envStore` has the same
  // response anyway.
  if (!fieldsConfig) {
    return { status: 'inactive' }
  }

  if (!isPossiblyActive) {
    return { status: 'inactive' }
  }

  // Nothing to wait for, and no organization to manage those fields.
  if (!organizationId) {
    return { status: 'active', isMmoMember: false, fieldsConfig }
  }

  // Everything missing is the user's own to fill in, so the organization cannot change this answer - the form goes
  // up without waiting, even if the request fails. Its fields do wait: a member who edits one gets the whole PATCH
  // rejected, while anybody else just sees them a moment late.
  if (!needsOrganization) {
    return { status: 'active', isMmoMember: organization ? Boolean(organization.is_mmo) : true, fieldsConfig }
  }

  if (organization) {
    const isMmoMember = Boolean(organization.is_mmo)
    // Asked again now that MMO status is known: it can take the organization's own fields out of the count.
    const blankFieldNames = getBlankRequiredProfileFieldNamesForAccount({
      account,
      userMetadataFields: fieldsConfig.userMetadataFields,
      isMmoMember,
    })
    return blankFieldNames.length > 0 ? { status: 'active', isMmoMember, fieldsConfig } : { status: 'inactive' }
  }

  // Terminal, because React Query has used up its retries by now. A non-200 counts too: the endpoint answers
  // 404 for an organization the account has been moved out of.
  if (organizationQuery.isError || organizationQuery.data) {
    return { status: 'error' }
  }

  return { status: 'pending' }
}
