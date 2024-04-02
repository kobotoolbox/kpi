import React, {createContext} from 'react';
import {getOrganization} from 'js/account/stripe.api';
import type {Organization} from 'js/account/stripe.types';
import {useApiFetcher, withApiFetcher} from 'js/hooks/useApiFetcher.hook';

const loadOrganization = async () => {
  const response = await getOrganization();
  return response?.results?.[0];
};

const INITIAL_ORGANIZATION_STATE: Organization = Object.freeze({
  id: '',
  name: '',
  is_active: false,
  created: '',
  modified: '',
  slug: '',
  is_owner: false,
});

export const useOrganization = () =>
  useApiFetcher(loadOrganization, INITIAL_ORGANIZATION_STATE);

export const OrganizationContext = createContext(
  withApiFetcher(INITIAL_ORGANIZATION_STATE)
);
