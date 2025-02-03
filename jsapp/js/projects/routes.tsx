import React from 'react';
import {Navigate, Route} from 'react-router-dom';
import RequireAuth from 'js/router/requireAuth';
import {PROJECTS_ROUTES} from 'js/router/routerConstants';
import {RequireOrgPermissions} from 'js/router/RequireOrgPermissions.component';
import { OrganizationUserRole } from '../account/organization/organizationQuery';

const MyProjectsRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './myProjectsRoute')
);
const MyOrgProjectsRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './myOrgProjectsRoute')
);
const CustomViewRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './customViewRoute')
);

export default function routes() {
  return (
    <>
      <Route
        path=''
        element={<Navigate to={PROJECTS_ROUTES.MY_PROJECTS} replace />}
      />
      <Route
        path={PROJECTS_ROUTES.MY_PROJECTS}
        element={
          <RequireAuth>
            <MyProjectsRoute />
          </RequireAuth>
        }
      />
      <Route
        path={PROJECTS_ROUTES.MY_ORG_PROJECTS}
        element={
          <RequireAuth>
            <RequireOrgPermissions
              validRoles={[
                OrganizationUserRole.owner,
                OrganizationUserRole.admin,
              ]}
              mmoOnly
              redirectRoute={PROJECTS_ROUTES.MY_PROJECTS}
            >
              <MyOrgProjectsRoute />
            </RequireOrgPermissions>
          </RequireAuth>
        }
      />
      <Route
        path={PROJECTS_ROUTES.CUSTOM_VIEW}
        element={
          <RequireAuth>
            <CustomViewRoute />
          </RequireAuth>
        }
      />
    </>
  );
}
