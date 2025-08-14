import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDelete, fetchGet } from '#/api'
import { endpoints } from '#/api.endpoints'
import type { InviteResponse } from '#/api/models/inviteResponse'
import type { Nullable } from '#/constants'
import type { PaginatedResponse } from '#/dataInterface'
import { QueryKeys } from '#/query/queryKeys'
import { useSession } from '#/stores/useSession'
import { type OrganizationUserRole, useOrganizationQuery } from './organizationQuery'

export interface OrganizationMember {
  /**
   * The url to the member within the organization
   * `/api/v2/organizations/<organization_uid>/members/<username>/`
   */
  url: string
  /** `/api/v2/users/<username>/` */
  user: string
  user__username: string
  /** can be an empty string in some edge cases */
  user__email: string | ''
  /** can be an empty string in some edge cases */
  user__extra_details__name: string | ''
  role: OrganizationUserRole
  user__has_mfa_enabled: boolean
  user__is_active: boolean
  /** yyyy-mm-dd HH:MM:SS */
  date_joined: string
}

export interface OrganizationMemberListItem extends Nullable<OrganizationMember> {
  invite?: InviteResponse
}

function getMemberEndpoint(orgId: string, username: string) {
  return endpoints.ORGANIZATION_MEMBER_URL.replace(':organization_id', orgId).replace(':username', username)
}

/**
 * Mutation hook for removing member from organization. It ensures that all
 * related queries refetch data (are invalidated).
 */
export function useRemoveOrganizationMember() {
  const queryClient = useQueryClient()

  const session = useSession()

  const orgQuery = useOrganizationQuery()
  const orgId = orgQuery.data?.id

  return useMutation({
    mutationFn: async (username: string) =>
      // We're asserting the `orgId` is not `undefined` here, because the parent
      // query (`useOrganizationMembersQuery`) wouldn't be enabled without it.
      // Plus all the organization-related UI (that would use this hook) is
      // accessible only to logged in users.
      fetchDelete(getMemberEndpoint(orgId!, username)),
    onSuccess: (_data, username) => {
      if (username === session.currentLoggedAccount?.username) {
        // If user is removing themselves, we need to clear the session
        session.refreshAccount()
      } else {
        queryClient.invalidateQueries({
          queryKey: [QueryKeys.organizationMembers],
        })
      }
    },
  })
}

/**
 * Fetches paginated list of members for given organization.
 * This is mainly needed for `useOrganizationMembersQuery`, so you most probably
 * would use it through that hook rather than directly.
 */
export async function getOrganizationMembers(limit: number, offset: number, orgId: string) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  })

  const apiUrl = endpoints.ORGANIZATION_MEMBERS_URL.replace(':organization_id', orgId)

  // Note: little crust ahead of time to make a simpler transition to generated react-query helpers.
  return {
    status: 200 as const,
    data: await fetchGet<PaginatedResponse<OrganizationMemberListItem>>(apiUrl + '?' + params, {
      errorMessageDisplay: t('There was an error getting the list.'),
    }),
  }
}

export function useOrganizationMemberDetailQuery(username: string, notifyAboutError = true) {
  const orgQuery = useOrganizationQuery()
  const orgId = orgQuery.data?.id
  // `orgId!` because it's ensured to be there in `enabled` property :ok:
  const apiPath = endpoints.ORGANIZATION_MEMBER_URL.replace(':organization_id', orgId!).replace(':username', username)
  return useQuery({
    queryFn: () => fetchGet<OrganizationMemberListItem>(apiPath, { notifyAboutError }),
    queryKey: [QueryKeys.organizationMemberDetail, apiPath, notifyAboutError],
    enabled: !!orgId,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
