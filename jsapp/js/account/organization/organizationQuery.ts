// Libraries
import {useMutation, useQuery, useQueryClient, type UndefinedInitialDataOptions} from '@tanstack/react-query';
import {useEffect} from 'react';

// Stores, hooks and utilities
import {fetchGetUrl, fetchPatch} from 'jsapp/js/api';
import {FeatureFlag, useFeatureFlag} from 'js/featureFlags';
import sessionStore from 'js/stores/session';
import {useSession} from 'jsapp/js/stores/useSession';

// Constants and types
import type {FailResponse} from 'js/dataInterface';
import {QueryKeys} from 'js/query/queryKeys';

// Comes from `kobo/apps/accounts/forms.py`
type OrganizationTypeName = 'non-profit' | 'government' | 'educational' | 'commercial' | 'none';

export const ORGANIZATION_TYPES: {
  [P in OrganizationTypeName]: {name: OrganizationTypeName; label: string}
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
  const queryClient = useQueryClient();
  const session = useSession();
  const organizationUrl = session.currentLoggedAccount?.organization?.url;

  return useMutation({
    mutationFn: async (data: Partial<Organization>) => (
      // We're asserting the `organizationUrl` is not `undefined` here, because
      // the parent query (`useOrganizationQuery`) wouldn't be enabled without
      // it. Plus all the organization-related UI is accessible only to
      // logged in users.
      fetchPatch<Organization>(organizationUrl!, data)
    ),
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: [QueryKeys.organization]});
    },
  });
}

/**
 * Organization object is used globally.
 * For convenience, errors are handled once at the top, see `RequireOrg`.
 * No need to handle errors at every usage.
 */
export const useOrganizationQuery = (options?: Omit<UndefinedInitialDataOptions<Organization, FailResponse, Organization, QueryKeys[]>, 'queryFn' | 'queryKey'>) => {
  const isMmosEnabled = useFeatureFlag(FeatureFlag.mmosEnabled);

  const session = useSession();
  const organizationUrl = session.currentLoggedAccount?.organization?.url;

  // Using a separated function to fetch the organization data to prevent
  // feature flag dependencies from being added to the hook
  const fetchOrganization = async (): Promise<Organization> => {
    // `organizationUrl` is a full url with protocol and domain name, so we're
    // using fetchGetUrl.
    // We're asserting the `organizationUrl` is not `undefined` here because
    // the query is disabled without it.
    const organization = await fetchGetUrl<Organization>(organizationUrl!);

    if (isMmosEnabled) {
      return organization;
    }

    // While the project is in development we will force a `false` return for
    // the `is_mmo` to make sure we don't have any implementations appearing
    // for users.
    return {
      ...organization,
      is_mmo: false,
    };
  };

  // Setting the 'enabled' property so the query won't run until we have
  // the session data loaded. Account data is needed to fetch the organization
  // data.
  const isQueryEnabled =
    !sessionStore.isPending &&
    sessionStore.isInitialLoadComplete &&
    !!organizationUrl;

  const query = useQuery<Organization, FailResponse, Organization, QueryKeys[]>({
    ...options,
    queryFn: fetchOrganization,
    queryKey: [QueryKeys.organization],
    enabled: isQueryEnabled && options?.enabled !== false,
  });

  // `organizationUrl` must exist, unless it's changed (e.g. user added/removed
  // from organization).
  // In such case, refetch `organizationUrl` to fetch the new `organizationUrl`.
  // DEBT: don't throw toast within `fetchGetUrl`.
  // DEBT: don't retry the failing url 3-4 times before switching to the new url.
  useEffect(() => {
    if (query.error?.status === 404) {
      sessionStore.refreshAccount();
    }
  }, [query.error?.status]);

  return query;
};
