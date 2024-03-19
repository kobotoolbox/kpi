import React, {createContext} from 'react';
import {getOrganization} from 'js/account/stripe.api';
import type {Organization} from 'js/account/stripe.types';
import {useApiFetcher} from 'js/hooks/useApiFetcher.hook';

const loadOrganization = async () => {
  const response = await getOrganization();
  return response?.results?.[0] || null;
};

export const useOrganization = () => useApiFetcher(loadOrganization);

export const OrganizationContext = createContext<
  [Organization | null, () => void]
>([null, () => {}]);
