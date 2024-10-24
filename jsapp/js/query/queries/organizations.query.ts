import {useQuery} from '@tanstack/react-query';
import {endpoints} from 'jsapp/js/api.endpoints';
import {fetchGet} from 'jsapp/js/api';
import type {PaginatedResponse} from 'jsapp/js/dataInterface';
import type {Organization} from 'jsapp/js/account/stripe.types';

export const useOrganizationQuery = () => useQuery({
  queryFn: async () => {
    const response = await fetchGet<PaginatedResponse<Organization>>(endpoints.ORGANIZATION_URL);
    return response.results?.[0]
  },
  queryKey: ['organization'],
});
