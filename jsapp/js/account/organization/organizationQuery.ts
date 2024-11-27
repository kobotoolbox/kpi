import type {FailResponse} from 'js/dataInterface';
import {fetchGetUrl} from 'jsapp/js/api';
import type {UndefinedInitialDataOptions} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';
import {QueryKeys} from 'js/query/queryKeys';
import {FeatureFlag, useFeatureFlag} from 'js/featureFlags';
import sessionStore from 'js/stores/session';
import {useEffect} from 'react';

export interface Organization {
  id: string;
  name: string;
  is_active: boolean;
  created: string;
  modified: string;
  slug: string;
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
 * Organization object is used globally.
 * For convenience, errors are handled once at the top, see `RequireOrg`.
 * No need to handle errors at every usage.
 */
export const useOrganizationQuery = (options?: Omit<UndefinedInitialDataOptions<Organization, FailResponse, Organization, QueryKeys[]>, 'queryFn' | 'queryKey'>) => {
  const isMmosEnabled = useFeatureFlag(FeatureFlag.mmosEnabled);

  const currentAccount = sessionStore.currentAccount;

  const organizationUrl =
  'organization' in currentAccount ? currentAccount.organization?.url : null;

  // Using a separated function to fetch the organization data to prevent
  // feature flag dependencies from being added to the hook
  const fetchOrganization = async (): Promise<Organization> => {
    // organizationUrl is a full url with protocol and domain name, so we're using fetchGetUrl
    // We're asserting the organizationUrl is not null here because the query is disabled if it is
    const organization = await fetchGetUrl<Organization>(organizationUrl!);

    if (isMmosEnabled) {
      return organization;
    }

    // While the project is in development we will force a false return for the is_mmo
    // to make sure we don't have any implementations appearing for users
    return {
      ...organization,
      is_mmo: false,
    };
  };

  // Setting the 'enabled' property so the query won't run until we have the session data
  // loaded. Account data is needed to fetch the organization data.
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

  // `organizationUrl` must exist, unless it's changed (e.g. user added/removed from organization).
  // In such case, refetch organizationUrl to fetch the new `organizationUrl`.
  // DEBT: don't throw toast within fetchGetUrl.
  // DEBT: don't retry the failing url 3-4 times before switching to the new url.
  useEffect(() => {
    if (query.error?.status === 404) {
      sessionStore.refreshAccount();
    }
  }, [query.error?.status]);

  return query;
};
