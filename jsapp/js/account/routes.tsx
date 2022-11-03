import React from 'react';
import {Navigate, Route} from 'react-router-dom';
import RequireAuth from 'js/router/requireAuth';
import {ROUTES} from 'js/router/routerConstants';

const ChangePassword = React.lazy(
  () => import(/* webpackPrefetch: true */ './changePassword')
);
const SecurityRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './securityRoute')
);
const PlanRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './planRoute')
);
const AccountSettings = React.lazy(
  () => import(/* webpackPrefetch: true */ './accountSettingsRoute')
);
const DataStorage = React.lazy(
  () => import(/* webpackPrefetch: true */ './dataStorageRoute')
);

export const ACCOUNT_ROUTES: {readonly [key: string]: string} = {
  ACCOUNT_SETTINGS: ROUTES.ACCOUNT_ROOT + '/settings',
  DATA_STORAGE: ROUTES.ACCOUNT_ROOT + '/data-storage',
  SECURITY: ROUTES.ACCOUNT_ROOT + '/security',
  PLAN: ROUTES.ACCOUNT_ROOT + '/plan',
  CHANGE_PASSWORD: ROUTES.ACCOUNT_ROOT + '/change-password',
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
      <Route
        path={ACCOUNT_ROUTES.PLAN}
        element={
          <RequireAuth>
            <PlanRoute />
          </RequireAuth>
        }
      />
      <Route
        path={ACCOUNT_ROUTES.DATA_STORAGE}
        element={
          <RequireAuth>
            <DataStorage />
          </RequireAuth>
        }
      />
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
            <ChangePassword />
          </RequireAuth>
        }
      />
    </>
  );
}
