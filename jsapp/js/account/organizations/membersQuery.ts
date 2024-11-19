import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {endpoints} from 'js/api.endpoints';
import type {PaginatedResponse} from 'js/dataInterface';
import {fetchGet} from 'js/api';
import {QueryKeys} from 'js/query/queryKeys';
import type {PaginatedQueryHookOptions} from 'js/universalTable/paginatedQueryUniversalTable.component';

export interface OrganizationMember {
  /**
   * The url to the member within the organization
   * `/api/v2/organizations/<organization_uid>/members/<username>/`
   */
  url: string;
  /** `/api/v2/users/<username>/` */
  user: string;
  user__username: string;
  /** can be empty an string in some edge cases */
  user__email: string | '';
  /** can be empty an string in some edge cases */
  user__name: string | '';
  role: 'admin' | 'owner' | 'member' | 'external';
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
 * Fetches paginated list of members for given organization. Requires
 * `options.organizationId` to work.
 * This is mainly needed for `useOrganizationMembersQuery`, so you most probably
 * would use it through that hook rather than directly.
 */
async function getOrganizationMembers(
  limit: number,
  offset: number,
  options?: PaginatedQueryHookOptions
) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  let apiUrl = endpoints.ORGANIZATION_MEMBERS_URL;
  if (options?.organizationId) {
    apiUrl = apiUrl.replace(':organization_id', options.organizationId);
  }

  return fetchGet<PaginatedResponse<OrganizationMember>>(
    apiUrl + '?' + params,
    {
      errorMessageDisplay: t('There was an error getting the list.'),
    }
  );
}

/**
 * A hook that gives you paginated list of organization members. Requires
 * `options.organizationId` to work.
 */
export default function useOrganizationMembersQuery(
  itemLimit: number,
  pageOffset: number,
  /**
   * This is optional only to satisfy TS in `PaginatedQueryUniversalTable`. In
   * reality, data will not be fetched properly without `organizationId` passed
   * in the `options` object - see `getOrganizationMembers()` for details.
   */
  options?: PaginatedQueryHookOptions
) {
  return useQuery({
    queryKey: [QueryKeys.organizationMembers, itemLimit, pageOffset, options],
    queryFn: () => getOrganizationMembers(itemLimit, pageOffset, options),
    placeholderData: keepPreviousData,
    // We might want to improve this in future, for now let's not retry
    retry: false,
    // The `refetchOnWindowFocus` option is `true` by default, I'm setting it
    // here so we don't forget about it.
    refetchOnWindowFocus: true,
  });
}
