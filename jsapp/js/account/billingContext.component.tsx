import React, {ReactNode} from 'react';
import {UsageContext, useUsage} from 'js/account/usage/useUsage.hook';
import {ProductsContext, useProducts} from 'js/account/useProducts.hook';
import {
  OrganizationContext,
  useOrganization,
} from 'js/account/organizations/useOrganization.hook';

export const BillingContext = (props: {children: ReactNode}) => {
  const organization = useOrganization();
  const usage = useUsage(organization);
  const products = useProducts();
  return (
    <OrganizationContext.Provider value={organization}>
      <UsageContext.Provider value={usage}>
        <ProductsContext.Provider value={products}>
          {props.children}
        </ProductsContext.Provider>
      </UsageContext.Provider>
    </OrganizationContext.Provider>
  );
};
