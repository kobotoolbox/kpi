import React from 'react';
import {UsageContext, useUsage} from 'js/account/usage/useUsage.hook';
import {ProductsContext, useProducts} from '../useProducts.hook';
import Plan from './plan.component';

export default function plansRoute() {
  const usage = useUsage();
  const products = useProducts();

  return (
    <UsageContext.Provider value={usage}>
      <ProductsContext.Provider value={products}>
        <Plan />
      </ProductsContext.Provider>
    </UsageContext.Provider>
  );
}
