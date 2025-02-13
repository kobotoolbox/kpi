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
import type {MemberInvite} from './membersInviteQuery';
import type {Json} from 'jsapp/js/components/common/common.interfaces';
import {useSession} from 'jsapp/js/stores/useSession';

export interface OrganizationMember {
  /**
   * The url to the member within the organization
   * `/api/v2/organizations/<organization_uid>/members/<username>/`
   */
  url: string;
  /** `/api/v2/users/<username>/` */
  user: string;
  user__username: string;
  /** can be an empty string in some edge cases */
  user__email: string | '';
  /** can be an empty string in some edge cases */
  user__extra_details__name: string | '';
  role: OrganizationUserRole;
  user__has_mfa_enabled: boolean;
  user__is_active: boolean;
  /** yyyy-mm-dd HH:MM:SS */
  date_joined: string;
  invite?: MemberInvite;
}

function getMemberEndpoint(orgId: string, username: string) {
  return endpoints.ORGANIZATION_MEMBER_URL.replace(
    ':organization_id',
    orgId
  ).replace(':username', username);
}

/**
 * Mutation hook for updating organization member. It ensures that all related
 * queries refetch data (are invalidated).
 */
export function usePatchOrganizationMember(username: string) {
  const queryClient = useQueryClient();

  const orgQuery = useOrganizationQuery();
  const orgId = orgQuery.data?.id;

  return useMutation({
    mutationFn: async (data: Partial<OrganizationMember>) =>
      // We're asserting the `orgId` is not `undefined` here, because the parent
      // query (`useOrganizationMembersQuery`) wouldn't be enabled without it.
      // Plus all the organization-related UI (that would use this hook) is
      // accessible only to logged in users.
      fetchPatch<OrganizationMember>(getMemberEndpoint(orgId!, username), data as Json),
    onSettled: () => {
      // We invalidate query, so it will refetch (instead of refetching it
      // directly, see: https://github.com/TanStack/query/discussions/2468)
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.organizationMembers],
      });
    },
  });
}

/**
 * Mutation hook for removing member from organization. It ensures that all
 * related queries refetch data (are invalidated).
 */
export function useRemoveOrganizationMember() {
  const queryClient = useQueryClient();

  const session = useSession();

  const orgQuery = useOrganizationQuery();
  const orgId = orgQuery.data?.id;

  return useMutation({
    mutationFn: async (username: string) =>
      // We're asserting the `orgId` is not `undefined` here, because the parent
      // query (`useOrganizationMembersQuery`) wouldn't be enabled without it.
      // Plus all the organization-related UI (that would use this hook) is
      // accessible only to logged in users.
       fetchDelete(getMemberEndpoint(orgId!, username))
    ,
    onSuccess: (_data, username) => {
      if (username === session.currentLoggedAccount?.username) {
        // If user is removing themselves, we need to clear the session
        session.refreshAccount();
      } else {
        queryClient.invalidateQueries({
          queryKey: [QueryKeys.organizationMembers],
        });
      }
    },
  });
}

/**
 * Fetches paginated list of members for given organization.
 * This is mainly needed for `useOrganizationMembersQuery`, so you most probably
 * would use it through that hook rather than directly.
 */
async function getOrganizationMembers(
  limit: number,
  offset: number,
  orgId: string
) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const apiUrl = endpoints.ORGANIZATION_MEMBERS_URL.replace(
    ':organization_id',
    orgId
  );

  return fetchGet<PaginatedResponse<OrganizationMember>>(
    apiUrl + '?' + params,
    {
      errorMessageDisplay: t('There was an error getting the list.'),
    }
  );
}

/**
 * A hook that gives you paginated list of organization members. Uses
 * `useOrganizationQuery` to get the id.
 */
export default function useOrganizationMembersQuery({
  limit,
  offset,
}: PaginatedQueryHookParams) {
  const orgQuery = useOrganizationQuery();
  const orgId = orgQuery.data?.id;

  return useQuery({
    queryKey: [QueryKeys.organizationMembers, limit, offset, orgId],
    // `orgId!` because it's ensured to be there in `enabled` property :ok:
    queryFn: () => getOrganizationMembers(limit, offset, orgId!),
    placeholderData: keepPreviousData,
    enabled: !!orgId,
    // We might want to improve this in future, for now let's not retry
    retry: false,
    // The `refetchOnWindowFocus` option is `true` by default, I'm setting it
    // here so we don't forget about it.
    refetchOnWindowFocus: true,
  });
}
