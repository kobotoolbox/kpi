import React, {ReactNode} from 'react';
import {UsageContext, useUsage} from 'js/account/usage/useUsage.hook';
import {ProductsContext, useProducts} from 'js/account/useProducts.hook';
import {
  useOrganizationQuery,
} from 'js/account/organizations/useOrganization.hook';
import sessionStore from 'js/stores/session';

export const BillingContextProvider = (props: {children: ReactNode}) => {
  const {
    data: organizationData,
  } = useOrganizationQuery();

  if (!sessionStore.isLoggedIn) {
    return <>{props.children}</>;
  }
  const usage = useUsage(organizationData?.id || null);
  const products = useProducts();
  return (
      <UsageContext.Provider value={usage}>
        <ProductsContext.Provider value={products}>
          {props.children}
        </ProductsContext.Provider>
      </UsageContext.Provider>
  );
};
