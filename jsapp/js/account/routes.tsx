import React from 'react';
import {Navigate, Route} from 'react-router-dom';
import RequireAuth from 'js/router/requireAuth';
import {ValidateOrgPermissions} from 'js/account/organizations/validateOrgPermissions.component';
import {OrganizationUserRole} from './stripe.types';
import {
  ACCOUNT_ROUTES,
  AccountSettings,
  AddOnsRoute,
  ChangePasswordRoute,
  DataStorage,
  PlansRoute,
  SecurityRoute,
  MembersRoute,
} from 'js/account/routes.constants';
import {useFeatureFlag, FeatureFlag} from 'js/featureFlags';

export default function routes() {
  const enableMMORoutes = useFeatureFlag(FeatureFlag.mmosEnabled);

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
            <ValidateOrgPermissions validRoles={[OrganizationUserRole.owner]}>
              <PlansRoute />
            </ValidateOrgPermissions>
          </RequireAuth>
        }
      />
      <Route
        path={ACCOUNT_ROUTES.ADD_ONS}
        index
        element={
          <RequireAuth>
            <ValidateOrgPermissions validRoles={[OrganizationUserRole.owner]}>
              <AddOnsRoute />
            </ValidateOrgPermissions>
          </RequireAuth>
        }
      />
      <Route
        path={ACCOUNT_ROUTES.USAGE}
        index
        element={
          <RequireAuth>
            <ValidateOrgPermissions
              validRoles={[
                OrganizationUserRole.owner,
                OrganizationUserRole.admin,
              ]}
            >
              <DataStorage activeRoute={ACCOUNT_ROUTES.USAGE} />
            </ValidateOrgPermissions>
          </RequireAuth>
        }
      />
      <Route
        path={ACCOUNT_ROUTES.USAGE_PROJECT_BREAKDOWN}
        element={
          <RequireAuth>
            <ValidateOrgPermissions
              validRoles={[
                OrganizationUserRole.owner,
                OrganizationUserRole.admin,
              ]}
            >
              <DataStorage
                activeRoute={ACCOUNT_ROUTES.USAGE_PROJECT_BREAKDOWN}
              />
            </ValidateOrgPermissions>
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
      {enableMMORoutes && (
        <>
          <Route
            path={ACCOUNT_ROUTES.ORGANIZATION_MEMBERS}
            element={
              <RequireAuth>
                <ValidateOrgPermissions mmoOnly>
                  <MembersRoute />
                </ValidateOrgPermissions>
              </RequireAuth>
            }
          />
          <Route
            path={ACCOUNT_ROUTES.ORGANIZATION_SETTINGS}
            element={
              <RequireAuth>
                <ValidateOrgPermissions
                  validRoles={[
                    OrganizationUserRole.owner,
                    OrganizationUserRole.admin,
                  ]}
                  mmoOnly
                >
                  <div>Organization settings view to be implemented</div>
                </ValidateOrgPermissions>
              </RequireAuth>
            }
          />
        </>
      )}
    </>
  );
}
