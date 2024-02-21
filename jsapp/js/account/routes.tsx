import React from 'react';
import {Navigate, Outlet, Route} from 'react-router-dom';
import RequireAuth from 'js/router/requireAuth';
import {ROUTES} from 'js/router/routerConstants';
import {UsageContext, useUsage} from 'js/account/usage/useUsage.hook';
import {ProductsContext, useProducts} from './useProducts.hook';

const ChangePasswordRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './changePasswordRoute.component')
);
const SecurityRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './security/securityRoute.component')
);
const PlansRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './plans/plan.component')
);
const AddOnsRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './add-ons/addOns.component')
);
const AccountSettings = React.lazy(
  () => import(/* webpackPrefetch: true */ './accountSettingsRoute')
);
const DataStorage = React.lazy(
  () => import(/* webpackPrefetch: true */ './usage/usage.component')
);

export const ACCOUNT_ROUTES: {readonly [key: string]: string} = {
  ACCOUNT_SETTINGS: ROUTES.ACCOUNT_ROOT + '/settings',
  USAGE: ROUTES.ACCOUNT_ROOT + '/usage',
  SECURITY: ROUTES.ACCOUNT_ROOT + '/security',
  PLAN: ROUTES.ACCOUNT_ROOT + '/plan',
  ADD_ONS: ROUTES.ACCOUNT_ROOT + '/addons',
  CHANGE_PASSWORD: ROUTES.ACCOUNT_ROOT + '/change-password',
};

const BillingOutlet = () => {
  const usage = useUsage();
  const products = useProducts();
  return (
    <RequireAuth>
      <UsageContext.Provider value={usage}>
        <ProductsContext.Provider value={products}>
          <Outlet />
        </ProductsContext.Provider>
      </UsageContext.Provider>
    </RequireAuth>
  );
};

export default function routes() {
  return (
    <>
      <Route
        path=''
        element={<Navigate to={ACCOUNT_ROUTES.ACCOUNT_SETTINGS} replace />}
      />
      <Route
        path={ACCOUNT_ROUTES.SECURITY}
        element={
          <RequireAuth>
            <SecurityRoute />
          </RequireAuth>
        }
      />
      <Route path={ACCOUNT_ROUTES.PLAN} element={<BillingOutlet />}>
        <Route index element={<PlansRoute />} />
      </Route>
      <Route path={ACCOUNT_ROUTES.ADD_ONS} element={<BillingOutlet />}>
        <Route index element={<AddOnsRoute />} />
      </Route>
      <Route path={ACCOUNT_ROUTES.USAGE} element={<BillingOutlet />}>
        <Route index element={<DataStorage />} />
      </Route>
      <Route
        path={ACCOUNT_ROUTES.ACCOUNT_SETTINGS}
        element={
          <RequireAuth>
            <AccountSettings />
          </RequireAuth>
        }
      />
      <Route
        path={ACCOUNT_ROUTES.CHANGE_PASSWORD}
        element={
          <RequireAuth>
            <ChangePasswordRoute />
          </RequireAuth>
        }
      />
    </>
  );
}
