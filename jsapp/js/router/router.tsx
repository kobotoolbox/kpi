import React, {Suspense} from 'react';
import {
  Navigate,
  Route,
  createHashRouter,
  createRoutesFromElements,
} from 'react-router-dom';
import App from 'js/app';
import {ROUTES} from './routerConstants';
import accountRoutes from 'js/account/routes';
import projectsRoutes from 'js/projects/routes';
import RequireAuth from './requireAuth';
import {FormPage, LibraryAssetEditor} from 'js/components/formEditors';
import MyLibraryRoute from 'js/components/library/myLibraryRoute';
import PublicCollectionsRoute from 'js/components/library/publicCollectionsRoute';
import AssetRoute from 'js/components/library/assetRoute';
import FormsSearchableList from 'js/lists/forms';
import SingleProcessingRoute from 'js/components/processing/singleProcessingRoute';
import PermProtectedRoute from 'js/router/permProtectedRoute';
import {PERMISSIONS_CODENAMES} from '../constants';
import {injectRouter} from './legacy';

const Reports = React.lazy(
  () => import(/* webpackPrefetch: true */ 'js/components/reports/reports')
);
const FormLanding = React.lazy(
  () => import(/* webpackPrefetch: true */ 'js/components/formLanding')
);
const FormSummary = React.lazy(
  () => import(/* webpackPrefetch: true */ 'js/components/formSummary')
);
const FormSubScreens = React.lazy(
  () => import(/* webpackPrefetch: true */ 'js/components/formSubScreens')
);
const FormXform = React.lazy(
  () => import(/* webpackPrefetch: true */ 'js/components/formXform')
);
const FormJson = React.lazy(
  () => import(/* webpackPrefetch: true */ 'js/components/formJson')
);
const SectionNotFound = React.lazy(
  () => import(/* webpackPrefetch: true */ 'js/components/sectionNotFound')
);
const FormNotFound = React.lazy(
  () => import(/* webpackPrefetch: true */ 'js/components/formNotFound')
);

export const router = createHashRouter(
  createRoutesFromElements(
    <Route path={ROUTES.ROOT} element={<App />}>
      <Route
        path={ROUTES.ROOT}
        element={<Navigate to={ROUTES.FORMS} replace />}
      />
      <Route path={ROUTES.ACCOUNT_ROOT}>{accountRoutes()}</Route>
      <Route path={ROUTES.PROJECTS_ROOT}>{projectsRoutes()}</Route>
      <Route path={ROUTES.LIBRARY}>
        <Route path='' element={<Navigate to={ROUTES.MY_LIBRARY} replace />} />
        <Route
          path={ROUTES.MY_LIBRARY}
          element={
            <RequireAuth>
              <MyLibraryRoute />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTES.PUBLIC_COLLECTIONS}
          element={
            <RequireAuth>
              <PublicCollectionsRoute />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTES.NEW_LIBRARY_ITEM}
          element={
            <RequireAuth>
              <LibraryAssetEditor />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTES.LIBRARY_ITEM}
          element={
            <PermProtectedRoute
              requiredPermissions={[PERMISSIONS_CODENAMES.view_asset]}
              protectedComponent={AssetRoute}
            />
          }
        />
        <Route
          path={ROUTES.EDIT_LIBRARY_ITEM}
          element={
            <PermProtectedRoute
              requiredPermissions={[PERMISSIONS_CODENAMES.change_asset]}
              protectedComponent={LibraryAssetEditor}
            />
          }
        />
        <Route
          path={ROUTES.NEW_LIBRARY_CHILD}
          element={
            <PermProtectedRoute
              requiredPermissions={[PERMISSIONS_CODENAMES.change_asset]}
              protectedComponent={LibraryAssetEditor}
            />
          }
        />
        <Route
          path={ROUTES.LIBRARY_ITEM_JSON}
          element={
            <PermProtectedRoute
              requiredPermissions={[PERMISSIONS_CODENAMES.view_asset]}
              protectedComponent={FormJson}
            />
          }
        />
        <Route
          path={ROUTES.LIBRARY_ITEM_XFORM}
          element={
            <PermProtectedRoute
              requiredPermissions={[PERMISSIONS_CODENAMES.view_asset]}
              protectedComponent={FormXform}
            />
          }
        />
      </Route>
      <Route path={ROUTES.FORMS}>
        <Route
          index
          element={
            <RequireAuth>
              <FormsSearchableList />
            </RequireAuth>
          }
        />
        <Route path={ROUTES.FORM}>
          <Route path='' element={<Navigate to={'./landing'} replace />} />

          <Route
            path={ROUTES.FORM_SUMMARY}
            element={
              <PermProtectedRoute
                requiredPermissions={[PERMISSIONS_CODENAMES.view_asset]}
                protectedComponent={FormSummary}
              />
            }
          />

          <Route
            path={ROUTES.FORM_LANDING}
            element={
              <PermProtectedRoute
                requiredPermissions={[PERMISSIONS_CODENAMES.view_asset]}
                protectedComponent={FormLanding}
              />
            }
          />

          <Route path={ROUTES.FORM_DATA}>
            <Route path='' element={<Navigate to={'./table'} replace />} />
            <Route
              path={ROUTES.FORM_REPORT}
              element={
                <PermProtectedRoute
                  requiredPermissions={[PERMISSIONS_CODENAMES.view_submissions]}
                  protectedComponent={Reports}
                />
              }
            />
            <Route
              path={ROUTES.FORM_TABLE}
              element={
                <PermProtectedRoute
                  protectedComponent={FormSubScreens}
                  requiredPermissions={[PERMISSIONS_CODENAMES.view_submissions]}
                />
              }
            />
            <Route
              path={ROUTES.FORM_DOWNLOADS}
              element={
                <PermProtectedRoute
                  protectedComponent={FormSubScreens}
                  requiredPermissions={[PERMISSIONS_CODENAMES.view_submissions]}
                />
              }
            />
            <Route
              path={ROUTES.FORM_GALLERY}
              element={
                <PermProtectedRoute
                  protectedComponent={FormSubScreens}
                  requiredPermissions={[PERMISSIONS_CODENAMES.view_submissions]}
                />
              }
            />
            <Route
              path={ROUTES.FORM_MAP}
              element={
                <PermProtectedRoute
                  protectedComponent={FormSubScreens}
                  requiredPermissions={[PERMISSIONS_CODENAMES.view_submissions]}
                />
              }
            />
            <Route
              path={ROUTES.FORM_MAP_BY}
              element={
                <PermProtectedRoute
                  protectedComponent={FormSubScreens}
                  requiredPermissions={[PERMISSIONS_CODENAMES.view_submissions]}
                />
              }
            />
            <Route
              path={ROUTES.FORM_PROCESSING}
              element={
                <PermProtectedRoute
                  requiredPermissions={[PERMISSIONS_CODENAMES.view_submissions]}
                  protectedComponent={SingleProcessingRoute}
                />
              }
            />
          </Route>

          <Route path={ROUTES.FORM_SETTINGS}>
            <Route
              index
              element={
                <PermProtectedRoute
                  protectedComponent={FormSubScreens}
                  requiredPermissions={[
                    PERMISSIONS_CODENAMES.change_metadata_asset,
                    PERMISSIONS_CODENAMES.change_asset,
                  ]}
                />
              }
            />
            <Route
              path={ROUTES.FORM_MEDIA}
              element={
                <PermProtectedRoute
                  protectedComponent={FormSubScreens}
                  requiredPermissions={[PERMISSIONS_CODENAMES.change_asset]}
                />
              }
            />
            <Route
              path={ROUTES.FORM_SHARING}
              element={
                <PermProtectedRoute
                  protectedComponent={FormSubScreens}
                  requiredPermissions={[PERMISSIONS_CODENAMES.manage_asset]}
                />
              }
            />
            <Route
              path={ROUTES.FORM_RECORDS}
              element={
                <PermProtectedRoute
                  protectedComponent={FormSubScreens}
                  requiredPermissions={[PERMISSIONS_CODENAMES.manage_asset]}
                />
              }
            />
            <Route
              path={ROUTES.FORM_REST}
              element={
                <PermProtectedRoute
                  protectedComponent={FormSubScreens}
                  requiredPermissions={[
                    PERMISSIONS_CODENAMES.change_asset,
                    PERMISSIONS_CODENAMES.view_submissions,
                  ]}
                  requireAll
                />
              }
            />
            <Route
              path={ROUTES.FORM_REST_HOOK}
              element={
                <PermProtectedRoute
                  protectedComponent={FormSubScreens}
                  requiredPermissions={[PERMISSIONS_CODENAMES.manage_asset]}
                />
              }
            />
          </Route>

          <Route
            path={ROUTES.FORM_JSON}
            element={
              <PermProtectedRoute
                protectedComponent={FormJson}
                requiredPermissions={[PERMISSIONS_CODENAMES.view_asset]}
              />
            }
          />
          <Route
            path={ROUTES.FORM_XFORM}
            element={
              <PermProtectedRoute
                protectedComponent={FormXform}
                requiredPermissions={[PERMISSIONS_CODENAMES.view_asset]}
              />
            }
          />
          <Route
            path={ROUTES.FORM_EDIT}
            element={
              <PermProtectedRoute
                protectedComponent={FormPage}
                requiredPermissions={[PERMISSIONS_CODENAMES.view_asset]}
              />
            }
          />
          {/**
           * TODO change this HACKFIX to a better solution
           *
           * Used to force refresh form sub routes. It's some kind of a weird
           * way of introducing a loading screen during sub route refresh.
           * See: https://github.com/kobotoolbox/kpi/issues/3925
           *
           * NOTE: To make this more noticeable, you can increase the
           * timeout in FormViewTabs' triggerRefresh().
           **/}
          <Route
            path={ROUTES.FORM_RESET}
            element={
              <PermProtectedRoute
                protectedComponent={FormSubScreens}
                requiredPermissions={[PERMISSIONS_CODENAMES.view_submissions]}
              />
            }
          />
        </Route>
        <Route
          path='*'
          element={
            <Suspense fallback={null}>
              <FormNotFound />
            </Suspense>
          }
        />
      </Route>
      <Route
        path='*'
        element={
          <Suspense fallback={null}>
            <SectionNotFound />
          </Suspense>
        }
      />
    </Route>
  )
);

injectRouter(router);

export default router;
