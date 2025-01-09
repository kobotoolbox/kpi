// Libraries
import {useMutation, useQuery} from '@tanstack/react-query';
import {useEffect} from 'react';

// Stores, hooks and utilities
import {fetchGetUrl, fetchPatch} from 'jsapp/js/api';
import {useSession} from 'jsapp/js/stores/useSession';

// Constants and types
import type {FailResponse} from 'js/dataInterface';
import {QueryKeys} from 'js/query/queryKeys';
import {queryClient} from 'jsapp/js/query/queryClient';

// Comes from `kobo/apps/accounts/forms.py`
export type OrganizationTypeName =
  | 'non-profit'
  | 'government'
  | 'educational'
  | 'commercial'
  | 'none';

export const ORGANIZATION_TYPES: {
  [P in OrganizationTypeName]: {name: OrganizationTypeName; label: string};
} = {
  'non-profit': {name: 'non-profit', label: t('Non-profit organization')},
  government: {name: 'government', label: t('Government institution')},
  educational: {name: 'educational', label: t('Educational organization')},
  commercial: {name: 'commercial', label: t('A commercial/for-profit company')},
  none: {name: 'none', label: t('I am not associated with any organization')},
};

export interface Organization {
  id: string;
  name: string;
  website: string;
  organization_type: OrganizationTypeName;
  created: string;
  modified: string;
  is_owner: boolean;
  is_mmo: boolean;
  request_user_role: OrganizationUserRole;
}

/**
 * Note that it's only possible to update the role via API to either `admin` or
 * `member`.
 */
export enum OrganizationUserRole {
  member = 'member',
  admin = 'admin',
  owner = 'owner',
}

/**
 * Mutation hook for updating organization. It ensures that all related queries
 * refetch data (are invalidated).
 */
export function usePatchOrganization() {
  const session = useSession();
  const organizationUrl = session.currentLoggedAccount?.organization?.url;

  return useMutation({
    mutationFn: async (data: Partial<Organization>) =>
      // We're asserting the `organizationUrl` is not `undefined` here, because
      // the parent query (`useOrganizationQuery`) wouldn't be enabled without
      // it. Plus all the organization-related UI is accessible only to
      // logged in users.
      fetchPatch<Organization>(organizationUrl!, data, {prependRootUrl: false}),
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: [QueryKeys.organization]});
    },
  });
}

interface OrganizationQueryParams {
  shouldForceInvalidation?: boolean;
}

/**
 * Organization object is used globally.
 * For convenience, errors are handled once at the top, see `RequireOrg`.
 * No need to handle errors at every usage. Has custom staleTime, so use params
 * to invalidate data and refetch when absolute latest data is needed.
 */
export const useOrganizationQuery = (params?: OrganizationQueryParams) => {
  useEffect(() => {
    if (params?.shouldForceInvalidation) {
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.organization],
        refetchType: 'none',
      });
    }
  }, [params?.shouldForceInvalidation]);

  const session = useSession();
  const organizationUrl = !session.isPending ? session.currentLoggedAccount?.organization?.url : undefined;

  // Setting the 'enabled' property so the query won't run until we have
  // the session data loaded. Account data is needed to fetch the organization
  // data.
  const query = useQuery<Organization, FailResponse>({
    staleTime: 1000 * 60 * 2,
    // We're asserting the `organizationUrl` is not `undefined` here because
    // the query is disabled without it.
    queryFn: () => fetchGetUrl<Organization>(organizationUrl!),
    queryKey: [QueryKeys.organization, organizationUrl],
    enabled: !!organizationUrl,
  });

  // `organizationUrl` must exist, unless it's changed (e.g. user added/removed
  // from organization).
  // In such case, refetch `organizationUrl` to fetch the new `organizationUrl`.
  // DEBT: don't throw toast within `fetchGetUrl`.
  // DEBT: don't retry the failing url 3-4 times before switching to the new url.
  useEffect(() => {
    if (query.error?.status === 404) {
      session.refreshAccount();
    }
  }, [query.error?.status]);

  return query;
};
