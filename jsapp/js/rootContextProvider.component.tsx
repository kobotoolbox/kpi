import React, {ReactNode} from 'react';
import {BillingContext} from 'js/account/billingContext.component';

/* This is a context provider that wraps the root element (in ./app.js)
 * Use this if you need to share context between, for example, the sidebar and the main page
 * *Don't* use this as a catch-all for context providers - make sure to wrap them around
 * the closest common parent component/route
 */
export const RootContextProvider = (props: {children: ReactNode}) => {
  return <BillingContext>{props.children}</BillingContext>;
};
