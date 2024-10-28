import {QueryKeys} from '../queryKeys';
import {useQuery} from '@tanstack/react-query';
import type {Organization} from 'jsapp/js/account/stripe.types';
import sessionStore from 'js/stores/session';

const getOrganizationFromPath = (organizationPath: string): Promise<Organization> =>

  // Mock something from path?
   Promise.resolve({
    name: 'Test Organization',
    created: '2024-01-01',
    modified: '2024-01-02',
    id: '123',
    is_active: true,
    is_owner: true,
    slug: organizationPath,
  });


/**
 * Query to get the organization information.
 */
export const useOrganizationQuery = () => {

  const {currentAccount} = sessionStore;

  const organizationPath = currentAccount?.organizationPath || '';
  const queryEnabled = !!currentAccount;

  return useQuery({
    queryKey: [QueryKeys.organization, organizationPath],
    queryFn: () => getOrganizationFromPath(organizationPath),
    enabled: queryEnabled,
  });
};
