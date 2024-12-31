// Libraries
import {
  useQuery,
  useQueryClient,
  useMutation,
  keepPreviousData,
} from '@tanstack/react-query';

// Stores, hooks and utilities
import {fetchGet, fetchPatch, fetchDelete} from 'js/api';
import {
  useOrganizationQuery,
  type OrganizationUserRole,
} from './organizationQuery';

// Constants and types
import {endpoints} from 'js/api.endpoints';
import type {PaginatedResponse} from 'js/dataInterface';
import {QueryKeys} from 'js/query/queryKeys';
import type {PaginatedQueryHookParams} from 'jsapp/js/universalTable/paginatedQueryUniversalTable.component';
import {type OrganizationMember} from './membersQuery';

/*
 * Note about invites - `membersQuery` holds a list of members, each containing
 * an optional `invite` property (i.e. invited users that are not members yet
 * will also appear on that list).
 */

export interface MemberInvite {
  /** '/api/v2/organizations/<organization_uid>/invites/<invite_uid>/' */
  url: string;
  /** yyyy-mm-dd HH:MM:SS */
  date_created: string;
  /** yyyy-mm-dd HH:MM:SS */
  date_modified: string;
  status: 'sent' | 'accepted' | 'expired' | 'declined';
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
    mutationFn: async (usernameOrEmail: string) => {
      console.log('mocking API response!', usernameOrEmail);

      return new Promise<MemberInvite>((resolve) => {
        setTimeout(
          () =>
            // TODO: this resolves with some mock data and it's fine. What is
            // NOT FINE is the fact that `membersQuery` will not contain this
            // mock :_-(
            resolve({
              url: `https://test.me/api/v2/organizations/${orgId}/invites/abc123`,
              date_created: '2024-11-22 11:22:33',
              date_modified: '2024-11-22 11:22:33',
              status: 'sent',
            }),
          2000
        );
      });

      // We're asserting the `orgId` is not `undefined` here, because the parent
      // query (`useOrganizationMembersQuery`) wouldn't be enabled without it.
      // Plus all the organization-related UI (that would use this hook) is
      // accessible only to logged in users.
      // TODO: uncomment lines below when API ready
      // const apiUrl = endpoints.ORG_INVITES_URL.replace(':organization_id', orgId!);
      // fetchPost<OrganizationMember>(apiUrl, usernameOrEmail);
    },
    onSettled: () => {
      // We invalidate query, so it will refetch (instead of refetching it
      // directly, see: https://github.com/TanStack/query/discussions/2468)
      queryClient.invalidateQueries({queryKey: [QueryKeys.organizationMembers]});
    },
  });
}

/**
 * Mutation hook that allows resending existing invite. It ensures that
 * `membersQuery` will refetch data (by invalidation).
 */
export function useResendMemberInvite() {
  const queryClient = useQueryClient();
  const orgQuery = useOrganizationQuery();
  const orgId = orgQuery.data?.id;

  return useMutation({
    mutationFn: async (inviteId: string) => {
      console.log('mocking resend invite API response!', inviteId);

      return new Promise<MemberInvite>((resolve) => {
        setTimeout(
          () =>
            // TODO: this resolves with some mock data and it's fine. What is
            // NOT FINE is the fact that `membersQuery` will not contain this
            // mock :_-(
            resolve({
              url: `https://test.me/api/v2/organizations/${orgId}/invites/abc123`,
              date_created: '2024-11-22 11:22:33',
              date_modified: '2024-11-22 11:22:33',
              status: 'sent',
            }),
          2000
        );
      });

      // We're asserting the `orgId` is not `undefined` here, because the parent
      // query (`useOrganizationMembersQuery`) wouldn't be enabled without it.
      // Plus all the organization-related UI (that would use this hook) is
      // accessible only to logged in users.
      // TODO: uncomment lines below when API ready
      // const apiUrl = endpoints.ORG_INVITE_URL
      //   .replace(':organization_id', orgId!)
      //   .replace(':invite_id', inviteId);
      // fetchPatch<OrganizationMember>(apiUrl, /* WHAT here? */);
    },
    onSettled: () => {
      // We invalidate query, so it will refetch (instead of refetching it
      // directly, see: https://github.com/TanStack/query/discussions/2468)
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
  const orgQuery = useOrganizationQuery();
  const orgId = orgQuery.data?.id;

  return useMutation({
    mutationFn: async (inviteId: string) => {
      console.log('mocking remove invite API response!', inviteId);

      return new Promise<void>((resolve) => {
        setTimeout(
          () =>
            // TODO: this resolves and it's fine. What is NOT FINE is the fact
            // that `membersQuery` will still contain invite that was removed :_-(
            resolve(),
          2000
        );
      });

      // We're asserting the `orgId` is not `undefined` here, because the parent
      // query (`useOrganizationMembersQuery`) wouldn't be enabled without it.
      // Plus all the organization-related UI (that would use this hook) is
      // accessible only to logged in users.
      // TODO: uncomment lines below when API ready
      // const apiUrl = endpoints.ORG_INVITE_URL
      //   .replace(':organization_id', orgId!)
      //   .replace(':invite_id', inviteId);
      // fetchDelete<OrganizationMember>(apiUrl);
    },
    onSettled: () => {
      // We invalidate query, so it will refetch (instead of refetching it
      // directly, see: https://github.com/TanStack/query/discussions/2468)
      queryClient.invalidateQueries({queryKey: [QueryKeys.organizationMembers]});
    },
  });
}
