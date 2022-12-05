import React from 'react';
import {Navigate, Route} from 'react-router-dom';
import RequireAuth from 'js/router/requireAuth';
import {ROUTES} from 'js/router/routerConstants';

const MyProjectsRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './myProjectsRoute')
);
const CustomViewsRoute = React.lazy(
  () => import(/* webpackPrefetch: true */ './customViewsRoute')
);

export const PROJECTS_ROUTES: {readonly [key: string]: string} = {
  MY_PROJECTS: ROUTES.PROJECTS_ROOT + '/home',
  CUSTOM_VIEW: ROUTES.PROJECTS_ROOT + '/:viewUid',
};

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
            <MyProjectsRoute/>
          </RequireAuth>
        }
      />
      <Route
        path={PROJECTS_ROUTES.CUSTOM_VIEW}
        element={
          <RequireAuth>
            <CustomViewsRoute/>
          </RequireAuth>
        }
      />
    </>
  );
}
