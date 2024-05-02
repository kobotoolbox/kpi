import React from 'react';
import {Navigate, Route} from 'react-router-dom';
import RequireAuth from 'js/router/requireAuth';
import {RequireOrgOwner} from 'js/account/organizations/requireOrgOwner.component';
import {
  ACCOUNT_ROUTES,
  AccountSettings,
  AddOnsRoute,
  ChangePasswordRoute,
  DataStorage,
  PlansRoute,
  SecurityRoute,
} from 'js/account/routes.constants';

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
        index
        element={
          <RequireAuth>
            <RequireOrgOwner>
              <PlansRoute />
            </RequireOrgOwner>
          </RequireAuth>
        }
      />
      <Route
        path={ACCOUNT_ROUTES.ADD_ONS}
        index
        element={
          <RequireAuth>
            <RequireOrgOwner>
              <AddOnsRoute />
            </RequireOrgOwner>
          </RequireAuth>
        }
      />
      <Route
        path={ACCOUNT_ROUTES.USAGE}
        index
        element={
          <RequireAuth>
            <RequireOrgOwner>
              <DataStorage activeRoute={ACCOUNT_ROUTES.USAGE} />
            </RequireOrgOwner>
          </RequireAuth>
        }
      />
      <Route
        path={ACCOUNT_ROUTES.USAGE_PROJECT_BREAKDOWN}
        element={
          <RequireAuth>
            <DataStorage activeRoute={ACCOUNT_ROUTES.USAGE_PROJECT_BREAKDOWN} />
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
            <ChangePasswordRoute />
          </RequireAuth>
        }
      />
    </>
  );
}
