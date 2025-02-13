import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { fetchPost, fetchGet, fetchPatchUrl, fetchDeleteUrl, FetchDataOptions } from 'js/api'
import { type OrganizationUserRole, useOrganizationQuery } from './organizationQuery'
import { QueryKeys } from 'js/query/queryKeys'
import { endpoints } from 'jsapp/js/api.endpoints'
import type { FailResponse, PaginatedResponse } from 'jsapp/js/dataInterface'
import type { OrganizationMember, OrganizationMemberListItem } from './membersQuery'
import type { Json } from 'jsapp/js/components/common/common.interfaces'

/*
 * NOTE: `invites` - `membersQuery` holds a list of members, each containing
 * an optional `invite` property (i.e. invited users that are not members yet
 * will also appear on that list). That's why we have mutation hooks here for
 * managing the invites. And each mutation will invalidate `membersQuery` to
 * make it refetch.
 */

/*
 * NOTE: `orgId` - we're assuming it is not `undefined` in code below,
 * because the parent query (`useOrganizationMembersQuery`) wouldn't be enabled
 * without it. Plus all the organization-related UI (that would use this hook)
 * is accessible only to logged in users.
 */

/**
 * The source of truth of statuses are at `OrganizationInviteStatusChoices` in
 * `kobo/apps/organizations/models.py`. This enum should be kept in sync.
 */
export enum MemberInviteStatus {
  accepted = 'accepted',
  cancelled = 'cancelled',
  declined = 'declined',
  expired = 'expired',
  pending = 'pending',
  resent = 'resent',
}

export interface MemberInvite {
  /** This is `endpoints.ORG_INVITE_URL`. */
  url: string
  /** Url of a user that have sent the invite. */
  invited_by: string
  organization_name: string
  status: MemberInviteStatus
  /** Username of user being invited. */
  invitee: string
  /** Target role of user being invited. */
  invitee_role: OrganizationUserRole
  /** Date format `yyyy-mm-dd HH:MM:SS`. */
  date_created: string
  /** Date format: `yyyy-mm-dd HH:MM:SS`. */
  date_modified: string
}

interface MemberInviteRequestBase {
  role: OrganizationUserRole
}

interface SendMemberInviteParams extends MemberInviteRequestBase {
  /** List of usernames. */
  invitees: string[]
  /** Target role for the invitied users. */
  role: OrganizationUserRole
}

interface MemberInviteUpdate extends MemberInviteRequestBase {
  status: MemberInviteStatus
}

/**
 * Mutation hook that allows sending invite for given user to join organization
 * (of logged in user). It ensures that `membersQuery` will refetch data (by
 * invalidation).
 */
export function useSendMemberInvite() {
  const queryClient = useQueryClient()
  const orgQuery = useOrganizationQuery()
  const orgId = orgQuery.data?.id
  const apiPath = endpoints.ORG_MEMBER_INVITES_URL.replace(':organization_id', orgId!)
  return useMutation({
    mutationFn: async (payload: SendMemberInviteParams & Json) => fetchPost<OrganizationMember>(apiPath, payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.organizationMembers] })
    },
  })
}

/**
 * Mutation hook that allows removing existing invite. It ensures that
 * `membersQuery` will refetch data (by invalidation).
 */
export function useRemoveMemberInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (inviteUrl: string) => fetchDeleteUrl<OrganizationMember>(inviteUrl),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.organizationMembers] })
    },
  })
}

/**
 * A hook that gives you a single organization member invite.
 */
export const useOrgMemberInviteQuery = (orgId: string, inviteId: string) => {
  const apiPath = endpoints.ORG_MEMBER_INVITE_DETAIL_URL.replace(':organization_id', orgId!).replace(
    ':invite_id',
    inviteId,
  )
  return useQuery<MemberInvite, FailResponse>({
    queryFn: () => fetchGet<MemberInvite>(apiPath),
    queryKey: [QueryKeys.organizationMemberInviteDetail, apiPath],
  })
}

/**
 * Mutation hook that allows patching existing invite. Use it to change
 * the status of the invite (e.g. decline invite). It ensures that both
 * `membersQuery` and `useOrgMemberInviteQuery` will refetch data (by
 * invalidation).
 *
 * If you want to handle errors in your component, use `displayErrorNotification`.
 */
export function usePatchMemberInvite(inviteUrl?: string, displayErrorNotification = true) {
  const queryClient = useQueryClient()
  const fetchOptions: FetchDataOptions = {}
  if (displayErrorNotification) {
    fetchOptions.errorMessageDisplay = t('There was an error updating this invitation.')
  } else {
    fetchOptions.notifyAboutError = false
  }
  return useMutation<MemberInvite | null, Error & FailResponse, Partial<MemberInviteUpdate>>({
    mutationFn: async (newInviteData: Partial<MemberInviteUpdate>) => {
      if (inviteUrl) {
        return fetchPatchUrl<MemberInvite>(inviteUrl, newInviteData, fetchOptions)
      } else return null
    },
    onMutate: async (mutationData) => {
      if (mutationData.role) {
        const qData = queryClient.getQueriesData({ queryKey: [QueryKeys.organizationMembers] })
        const query = qData.find((q) =>
          (q[1] as any)?.results?.find((m: OrganizationMemberListItem) => m.invite?.url === inviteUrl),
        )

        if (!query) return

        const queryKey = query[0]
        const queryData = query[1]
        const item = (queryData as any).results.find((m: OrganizationMemberListItem) => m.invite?.url === inviteUrl)

        item.invite.invitee_role = mutationData.role
        queryClient.setQueryData(queryKey, queryData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.organizationMemberInviteDetail],
      })
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.organizationMembers],
      })
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.organizationMemberDetail],
      })
    },
  })
}
