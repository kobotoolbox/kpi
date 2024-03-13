import React, {createContext, useEffect, useState} from 'react';
import {getOrganization} from 'js/account/stripe.api';
import type {Organization} from 'js/account/stripe.types';

export function useOrganization() {
  const [organization, setOrganization] = useState<Organization | null>(null);

  useEffect(() => {
    getOrganization().then((orgResponse) => {
      setOrganization(orgResponse.results?.[0] || null);
    });
  }, []);

  return organization;
}

export const OrganizationContext = createContext<Organization | null>(null);
