import {
  useQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';
import {fetchPost, fetchGet, fetchPatchUrl, fetchDeleteUrl} from 'js/api';
import {type OrganizationUserRole, useOrganizationQuery} from './organizationQuery';
import {QueryKeys} from 'js/query/queryKeys';
import {endpoints} from 'jsapp/js/api.endpoints';
import type {FailResponse} from 'jsapp/js/dataInterface';
import {type OrganizationMember} from './membersQuery';
import {type Json} from 'jsapp/js/components/common/common.interfaces';

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
enum MemberInviteStatus {
  accepted = 'accepted',
  cancelled = 'cancelled',
  complete = 'complete',
  declined = 'declined',
  expired = 'expired',
  failed = 'failed',
  in_progress = 'in_progress',
  pending = 'pending',
  resent = 'resent',
}

export interface MemberInvite {
  /** This is `endpoints.ORG_INVITE_URL`. */
  url: string;
  /** Url of a user that have sent the invite. */
  invited_by: string;
  status: MemberInviteStatus;
  /** Username of user being invited. */
  invitee: string;
  /** Target role of user being invited. */
  invitee_role: OrganizationUserRole;
  /** Date format `yyyy-mm-dd HH:MM:SS`. */
  date_created: string;
  /** Date format: `yyyy-mm-dd HH:MM:SS`. */
  date_modified: string;
}

interface SendMemberInviteParams {
  /** List of usernames. */
  invitees: string[];
  /** Target role for the invitied users. */
  role: OrganizationUserRole;
}

/**
 * Mutation hook that allows sending invite for given user to join organization
 * (of logged in user). It ensures that `membersQuery` will refetch data (by
 * invalidation).
 */
export function useSendMemberInvite() {
  const queryClient = useQueryClient();
  const orgQuery = useOrganizationQuery();
  const orgId = orgQuery.data?.id;
  return useMutation({
    mutationFn: async (payload: SendMemberInviteParams & Json) => {
      const apiPath = endpoints.ORG_MEMBER_INVITES_URL.replace(':organization_id', orgId!);
      fetchPost<OrganizationMember>(apiPath, payload);
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: [QueryKeys.organizationMembers]});
    },
  });
}

/**
 * Mutation hook that allows removing existing invite. It ensures that
 * `membersQuery` will refetch data (by invalidation).
 */
export function useRemoveMemberInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteUrl: string) => {
      fetchDeleteUrl<OrganizationMember>(inviteUrl);
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: [QueryKeys.organizationMembers]});
    },
  });
}

/**
 * A hook that gives you a single organization member invite.
 */
export const useOrgMemberInviteQuery = (orgId: string, inviteId: string) => {
  const apiPath = endpoints.ORG_MEMBER_INVITE_DETAIL_URL
    .replace(':organization_id', orgId!)
    .replace(':invite_id', inviteId);
  return useQuery<MemberInvite, FailResponse>({
    queryFn: () => fetchGet<MemberInvite>(apiPath),
    queryKey: [QueryKeys.organizationMemberInviteDetail, apiPath],
  });
};

/**
 * Mutation hook that allows patching existing invite. Use it to change
 * the status of the invite (e.g. decline invite). It ensures that both
 * `membersQuery` and `useOrgMemberInviteQuery` will refetch data (by
 * invalidation).
 */
export function usePatchMemberInvite(inviteUrl: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newInviteData: Partial<MemberInvite>) => {
      fetchPatchUrl<OrganizationMember>(inviteUrl, newInviteData);
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: [
        QueryKeys.organizationMemberInviteDetail,
        QueryKeys.organizationMembers,
      ]});
    },
  });
}
