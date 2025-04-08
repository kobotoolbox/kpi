import React, { type ReactNode } from 'react'

import { BillingContextProvider } from '#/account/billingContextProvider.component'

/* This context provider that wraps the root element (in ./app.js)
 * *Avoid* adding additional providers here unless you *truly* need global state
 * If the components consuming the context have a common parent element lower in the
 * render tree, the context providers should live there
 */
export const RootContextProvider = (props: { children: ReactNode }) => (
  <BillingContextProvider>{props.children}</BillingContextProvider>
)
