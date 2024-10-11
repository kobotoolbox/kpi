import {useQuery} from '@tanstack/react-query';
import {getOrganization} from 'js/account/stripe.api';

const loadOrganization = async () => {
  const response = await getOrganization();
  return response?.results?.[0];
};

export const useOrganizationQuery = () => useQuery({
  queryFn: loadOrganization,
  queryKey: ['organization'],
});
