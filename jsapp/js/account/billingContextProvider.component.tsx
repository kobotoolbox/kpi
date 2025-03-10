import React, { type ReactNode } from 'react'

import { useOrganizationQuery } from '#/account/organization/organizationQuery'
import { UsageContext, useUsage } from '#/account/usage/useUsage.hook'
import { ProductsContext, useProducts } from '#/account/useProducts.hook'
import sessionStore from '#/stores/session'
import { OneTimeAddOnsContext, useOneTimeAddOns } from './useOneTimeAddonList.hook'

export const BillingContextProvider = (props: { children: ReactNode }) => {
  const orgQuery = useOrganizationQuery()

  if (!sessionStore.isLoggedIn) {
    return <>{props.children}</>
  }

  const usage = useUsage(orgQuery.data?.id || null)
  const products = useProducts()
  const oneTimeAddOns = useOneTimeAddOns()
  return (
    <UsageContext.Provider value={usage}>
      <ProductsContext.Provider value={products}>
        <OneTimeAddOnsContext.Provider value={oneTimeAddOns}>{props.children}</OneTimeAddOnsContext.Provider>
      </ProductsContext.Provider>
    </UsageContext.Provider>
  )
}
