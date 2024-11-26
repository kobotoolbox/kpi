import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {endpoints} from 'js/api.endpoints';
import type {PaginatedResponse} from 'js/dataInterface';
import {fetchGet} from 'js/api';
import {QueryKeys} from 'js/query/queryKeys';
import {useOrganizationQuery, type OrganizationUserRole} from './organizationQuery';

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
  invite?: {
    /** '/api/v2/organizations/<organization_uid>/invites/<invite_uid>/' */
    url: string;
    /** yyyy-mm-dd HH:MM:SS */
    date_created: string;
    /** yyyy-mm-dd HH:MM:SS */
    date_modified: string;
    status: 'sent' | 'accepted' | 'expired' | 'declined';
  };
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

  const apiUrl = endpoints.ORGANIZATION_MEMBERS_URL.replace(':organization_id', orgId);

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
export default function useOrganizationMembersQuery(
  itemLimit: number,
  pageOffset: number
) {
  const orgQuery = useOrganizationQuery();
  const orgId = orgQuery.data?.id;

  return useQuery({
    queryKey: [QueryKeys.organizationMembers, itemLimit, pageOffset, orgId],
    // `orgId!` because it's ensured to be there in `enabled` property :ok:
    queryFn: () => getOrganizationMembers(itemLimit, pageOffset, orgId!),
    placeholderData: keepPreviousData,
    enabled: !!orgId,
    // We might want to improve this in future, for now let's not retry
    retry: false,
    // The `refetchOnWindowFocus` option is `true` by default, I'm setting it
    // here so we don't forget about it.
    refetchOnWindowFocus: true,
  });
}
