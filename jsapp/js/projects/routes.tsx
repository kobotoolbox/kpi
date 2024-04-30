import React from 'react';
import {Navigate, Route} from 'react-router-dom';
import RequireAuth from 'js/router/requireAuth';
import {PROJECTS_ROUTES} from 'js/router/routerConstants';

const MyProjectsRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './myProjectsRoute')
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
