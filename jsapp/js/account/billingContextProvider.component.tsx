import React, { type ReactNode } from 'react'
import { ProductsContext, useProducts } from '#/account/useProducts.hook'
import sessionStore from '#/stores/session'
import { OneTimeAddOnsContext, useOneTimeAddOns } from './useOneTimeAddonList.hook'

export const BillingContextProvider = (props: { children: ReactNode }) => {
  if (!sessionStore.isLoggedIn) {
    return <>{props.children}</>
  }

  const products = useProducts()
  const oneTimeAddOns = useOneTimeAddOns()
  return (
    <ProductsContext.Provider value={products}>
      <OneTimeAddOnsContext.Provider value={oneTimeAddOns}>{props.children}</OneTimeAddOnsContext.Provider>
    </ProductsContext.Provider>
  )
}
