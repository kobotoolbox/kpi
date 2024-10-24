import {QueryKeys} from '../queryKeys';
import {useQuery} from '@tanstack/react-query';
import {useMeQuery} from './meQuery';
import type {Organization} from 'jsapp/js/account/stripe.types';


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

  const {data: me} = useMeQuery();

  const organizationPath = me?.organizationPath || '';
  const queryEnabled = !!me;

  return useQuery({
    queryKey: [QueryKeys.organization, organizationPath],
    queryFn: () => getOrganizationFromPath(organizationPath),
    enabled: queryEnabled,
  });
};
