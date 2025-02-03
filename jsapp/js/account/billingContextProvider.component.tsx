import React, {ReactNode} from 'react';
import { OneTimeAddOnsContext, useOneTimeAddOns } from './useOneTimeAddonList.hook';
import {UsageContext, useUsage} from 'js/account/usage/useUsage.hook';
import {ProductsContext, useProducts} from 'js/account/useProducts.hook';
import sessionStore from 'js/stores/session';
import {useOrganizationQuery} from 'js/account/organization/organizationQuery';

export const BillingContextProvider = (props: {children: ReactNode}) => {
  const orgQuery = useOrganizationQuery();

  if (!sessionStore.isLoggedIn) {
    return <>{props.children}</>;
  }

  const usage = useUsage(orgQuery.data?.id || null);
  const products = useProducts();
  const oneTimeAddOns = useOneTimeAddOns();
  return (
    <UsageContext.Provider value={usage}>
      <ProductsContext.Provider value={products}>
        <OneTimeAddOnsContext.Provider value={oneTimeAddOns}>
            {props.children}
        </OneTimeAddOnsContext.Provider>
      </ProductsContext.Provider>
    </UsageContext.Provider>
  );
};
