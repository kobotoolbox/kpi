import React, {Suspense} from 'react';
import {observer} from 'mobx-react';
import autoBind from 'react-autobind';
import {Navigate, Routes} from 'react-router-dom';
import App from 'js/app';
import {FormPage, LibraryAssetEditor} from 'js/components/formEditors';
import {actions} from 'js/actions';
import MyLibraryRoute from 'js/components/library/myLibraryRoute';
import PublicCollectionsRoute from 'js/components/library/publicCollectionsRoute';
import AssetRoute from 'js/components/library/assetRoute';
import FormsSearchableList from 'js/lists/forms';
import SingleProcessingRoute from 'js/components/processing/singleProcessingRoute';
import {ROUTES} from 'js/router/routerConstants';
import permConfig from 'js/components/permissions/permConfig';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {PERMISSIONS_CODENAMES} from 'js/constants';
import {isRootRoute, redirectToLogin} from 'js/router/routerUtils';
import RequireAuth from 'js/router/requireAuth';
import PermProtectedRoute from 'js/router/permProtectedRoute';
import sessionStore from 'js/stores/session';
import {Tracking} from './useTracking';
import {history} from './historyRouter';
import accountRoutes from 'js/account/routes';
import projectsRoutes from 'js/projects/routes';

// Workaround https://github.com/remix-run/react-router/issues/8139
import {unstable_HistoryRouter as HistoryRouter, Route} from 'react-router-dom';

const Reports = React.lazy(() =>
  import(/* webpackPrefetch: true */ 'js/components/reports/reports')
);
const FormLanding = React.lazy(() =>
  import(/* webpackPrefetch: true */ 'js/components/formLanding')
);
const FormSummary = React.lazy(() =>
  import(/* webpackPrefetch: true */ 'js/components/formSummary')
);
const FormSubScreens = React.lazy(() =>
  import(/* webpackPrefetch: true */ 'js/components/formSubScreens')
);
const FormXform = React.lazy(() =>
  import(/* webpackPrefetch: true */ 'js/components/formXform')
);
const FormJson = React.lazy(() =>
  import(/* webpackPrefetch: true */ 'js/components/formJson')
);
const SectionNotFound = React.lazy(() =>
  import(/* webpackPrefetch: true */ 'js/components/sectionNotFound')
);
const FormNotFound = React.lazy(() =>
  import(/* webpackPrefetch: true */ 'js/components/formNotFound')
);

const AllRoutes = class AllRoutes extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isPermsConfigReady: permConfig.isReady(),
    };
    autoBind(this);
  }

  componentDidMount() {
    actions.permissions.getConfig.completed.listen(
      this.onGetConfigCompleted.bind(this)
    );
    actions.permissions.getConfig();
  }

  onGetConfigCompleted(response) {
    permConfig.setPermissions(response.results);
    this.setReady({isPermsConfigReady: permConfig.isReady()});
  }

  /**
   * This convoluted function wants to check if redirect should be made before
   * setting the state - which would cause an unwanted rerender.
   *
   * @param {object} data
   * @param {boolean} [data.isPermsConfigReady]
   * @param {boolean} [data.isSessionReady]
   */
  setReady(data) {
    const newStateObj = {
      isPermsConfigReady: this.state.isPermsConfigReady,
      isSessionReady: this.state.isSessionReady,
    };

    if (typeof data.isPermsConfigReady !== 'undefined') {
      newStateObj.isPermsConfigReady = data.isPermsConfigReady;
    }

    if (typeof data.isSessionReady !== 'undefined') {
      newStateObj.isSessionReady = data.isSessionReady;
    }

    if (
      !(
        newStateObj.isPermsConfigReady &&
        newStateObj.isSessionReady &&
        !sessionStore.isLoggedIn &&
        isRootRoute()
      )
    ) {
      this.setState(newStateObj);
    }
  }

  render() {
    // This is the place that stops any app rendering until all necessary
    // backend calls are done.
    if (!this.state.isPermsConfigReady || !sessionStore.isAuthStateKnown) {
      return <LoadingSpinner />;
    }

    // If all necessary data is obtained, and user is not logged in, and on
    // the root route, redirect immediately to the login page outside
    // the React app, and skip setting the state (so no content blink).
    if (!sessionStore.isLoggedIn && isRootRoute()) {
      redirectToLogin();
      // redirect is async, continue showing loading
      return <LoadingSpinner />;
    }

    return (
      <HistoryRouter history={history}>
        <Tracking />
        <Routes>
          <Route path={ROUTES.ROOT} element={<App />}>
            <Route path='' element={<Navigate to={ROUTES.FORMS} replace />} />
            <Route path={ROUTES.ACCOUNT_ROOT}>{accountRoutes()}</Route>
            <Route path={ROUTES.PROJECTS_ROOT}>{projectsRoutes()}</Route>
            <Route path={ROUTES.LIBRARY}>
              <Route
                path=''
                element={<Navigate to={ROUTES.MY_LIBRARY} replace />}
              />
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
                    requiredPermission={PERMISSIONS_CODENAMES.view_asset}
                    protectedComponent={AssetRoute}
                  />
                }
              />
              <Route
                path={ROUTES.EDIT_LIBRARY_ITEM}
                element={
                  <PermProtectedRoute
                    requiredPermission={PERMISSIONS_CODENAMES.change_asset}
                    protectedComponent={LibraryAssetEditor}
                  />
                }
              />
              <Route
                path={ROUTES.NEW_LIBRARY_CHILD}
                element={
                  <PermProtectedRoute
                    requiredPermission={PERMISSIONS_CODENAMES.change_asset}
                    protectedComponent={LibraryAssetEditor}
                  />
                }
              />
              <Route
                path={ROUTES.LIBRARY_ITEM_JSON}
                element={
                  <PermProtectedRoute
                    requiredPermission={PERMISSIONS_CODENAMES.view_asset}
                    protectedComponent={FormJson}
                  />
                }
              />
              <Route
                path={ROUTES.LIBRARY_ITEM_XFORM}
                element={
                  <PermProtectedRoute
                    requiredPermission={PERMISSIONS_CODENAMES.view_asset}
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
                <Route
                  path=''
                  element={<Navigate to={'./landing'} replace />}
                />

                <Route
                  path={ROUTES.FORM_SUMMARY}
                  element={
                    <PermProtectedRoute
                      requiredPermission={
                        PERMISSIONS_CODENAMES.view_submissions
                      }
                      protectedComponent={FormSummary}
                    />
                  }
                />

                <Route
                  path={ROUTES.FORM_LANDING}
                  element={
                    <PermProtectedRoute
                      requiredPermission={PERMISSIONS_CODENAMES.view_asset}
                      protectedComponent={FormLanding}
                    />
                  }
                />

                <Route path={ROUTES.FORM_DATA}>
                  <Route
                    path=''
                    element={<Navigate to={'./table'} replace />}
                  />
                  <Route
                    path={ROUTES.FORM_REPORT}
                    element={
                      <PermProtectedRoute
                        requiredPermission={
                          PERMISSIONS_CODENAMES.view_submissions
                        }
                        protectedComponent={Reports}
                      />
                    }
                  />
                  <Route
                    path={ROUTES.FORM_REPORT_OLD}
                    element={
                      <PermProtectedRoute
                        protectedComponent={FormSubScreens}
                        requiredPermission={
                          PERMISSIONS_CODENAMES.view_submissions
                        }
                      />
                    }
                  />
                  <Route
                    path={ROUTES.FORM_TABLE}
                    element={
                      <PermProtectedRoute
                        protectedComponent={FormSubScreens}
                        requiredPermission={
                          PERMISSIONS_CODENAMES.view_submissions
                        }
                      />
                    }
                  />
                  <Route
                    path={ROUTES.FORM_DOWNLOADS}
                    element={
                      <PermProtectedRoute
                        protectedComponent={FormSubScreens}
                        requiredPermission={
                          PERMISSIONS_CODENAMES.view_submissions
                        }
                      />
                    }
                  />
                  <Route
                    path={ROUTES.FORM_GALLERY}
                    element={
                      <PermProtectedRoute
                        protectedComponent={FormSubScreens}
                        requiredPermission={
                          PERMISSIONS_CODENAMES.view_submissions
                        }
                      />
                    }
                  />
                  <Route
                    path={ROUTES.FORM_MAP}
                    element={
                      <PermProtectedRoute
                        protectedComponent={FormSubScreens}
                        requiredPermission={
                          PERMISSIONS_CODENAMES.view_submissions
                        }
                      />
                    }
                  />
                  <Route
                    path={ROUTES.FORM_MAP_BY}
                    element={
                      <PermProtectedRoute
                        protectedComponent={FormSubScreens}
                        requiredPermission={
                          PERMISSIONS_CODENAMES.view_submissions
                        }
                      />
                    }
                  />
                  <Route
                    path={ROUTES.FORM_PROCESSING}
                    element={
                      <PermProtectedRoute
                      requiredPermission={PERMISSIONS_CODENAMES.view_submissions}
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
                        requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
                      />
                    }
                  />
                  <Route
                    path={ROUTES.FORM_MEDIA}
                    element={
                      <PermProtectedRoute
                        protectedComponent={FormSubScreens}
                        requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
                      />
                    }
                  />
                  <Route
                    path={ROUTES.FORM_SHARING}
                    element={
                      <PermProtectedRoute
                        protectedComponent={FormSubScreens}
                        requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
                      />
                    }
                  />
                  <Route
                    path={ROUTES.FORM_RECORDS}
                    element={
                      <PermProtectedRoute
                        protectedComponent={FormSubScreens}
                        requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
                      />
                    }
                  />
                  <Route
                    path={ROUTES.FORM_REST}
                    element={
                      <PermProtectedRoute
                        protectedComponent={FormSubScreens}
                        requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
                      />
                    }
                  />
                  <Route
                    path={ROUTES.FORM_REST_HOOK}
                    element={
                      <PermProtectedRoute
                        protectedComponent={FormSubScreens}
                        requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
                      />
                    }
                  />
                  <Route
                    path={ROUTES.FORM_KOBOCAT}
                    element={
                      <PermProtectedRoute
                        protectedComponent={FormSubScreens}
                        requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
                      />
                    }
                  />
                </Route>

                <Route
                  path={ROUTES.FORM_JSON}
                  element={
                    <PermProtectedRoute
                      protectedComponent={FormJson}
                      requiredPermission={PERMISSIONS_CODENAMES.view_asset}
                    />
                  }
                />
                <Route
                  path={ROUTES.FORM_XFORM}
                  element={
                    <PermProtectedRoute
                      protectedComponent={FormXform}
                      requiredPermission={PERMISSIONS_CODENAMES.view_asset}
                    />
                  }
                />
                <Route
                  path={ROUTES.FORM_EDIT}
                  element={
                    <PermProtectedRoute
                      protectedComponent={FormPage}
                      requiredPermission={PERMISSIONS_CODENAMES.view_asset}
                    />
                  }
                />
                {/**
                 * TODO change this HACKFIX to a better solution
                 *
                 * Used to force refresh form sub routes. It's some kine of a weird
                 * way of introducing a loading screen during sub route refresh.
                 * See: https://github.com/kobotoolbox/kpi/issues/3925
                 **/}
                <Route
                  path={ROUTES.FORM_RESET}
                  element={
                    <PermProtectedRoute
                      protectedComponent={FormSubScreens}
                      requiredPermission={
                        PERMISSIONS_CODENAMES.view_submissions
                      }
                    />
                  }
                />
              </Route>
              <Route path='*' component={FormNotFound} />
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
        </Routes>
      </HistoryRouter>
    );
  }
};

export default observer(AllRoutes);
