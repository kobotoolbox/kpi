import React from 'react';
import autoBind from 'react-autobind';
import {
  IndexRoute,
  IndexRedirect,
  Route,
  hashHistory,
  Router,
} from 'react-router';
import App from 'js/app';
import {
  FormPage,
  LibraryAssetEditor,
} from 'js/components/formEditors';
import {actions} from 'js/actions';
import {stores} from 'js/stores';
import {envStore} from 'js/envStore'; // initializing it
import MyLibraryRoute from 'js/components/library/myLibraryRoute';
import PublicCollectionsRoute from 'js/components/library/publicCollectionsRoute';
import AssetRoute from 'js/components/library/assetRoute';
import Reports from 'js/components/reports/reports';
import FormLanding from 'js/components/formLanding';
import FormSummary from 'js/components/formSummary';
import FormSubScreens from 'js/components/formSubScreens';
import AccountSettings from 'js/components/account/accountSettingsRoute';
import DataStorage from 'js/components/account/dataStorageRoute';
import Security from 'js/components/account/securityRoute';
import ChangePassword from 'js/components/changePassword';
import SectionNotFound from 'js/components/sectionNotFound';
import FormNotFound from 'js/components/formNotFound';
import FormXform from 'js/components/formXform';
import FormJson from 'js/components/formJson';
import FormsSearchableList from 'js/lists/forms';
import {ROUTES} from 'js/router/routerConstants';
import permConfig from 'js/components/permissions/permConfig';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {
  isRootRoute,
  redirectToLogin,
} from 'js/router/routerUtils';
import AuthProtectedRoute from 'js/router/authProtectedRoute';
import PermProtectedRoute from 'js/router/permProtectedRoute';
import {PERMISSIONS_CODENAMES} from 'js/constants';

export default class AllRoutes extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isPermsConfigReady: permConfig.isReady(),
      isSessionReady: stores.session.isAuthStateKnown,
    };
    autoBind(this);
  }

  componentDidMount() {
    actions.permissions.getConfig.completed.listen(this.onGetConfigCompleted);
    stores.session.listen(this.onSessionChange);
    actions.permissions.getConfig();
  }

  onGetConfigCompleted(response) {
    permConfig.setPermissions(response.results);
    this.setReady({isPermsConfigReady: permConfig.isReady()});
  }

  onSessionChange() {
    this.setReady({isSessionReady: stores.session.isAuthStateKnown});
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
      newStateObj.isPermsConfigReady &&
      newStateObj.isSessionReady &&
      !stores.session.isLoggedIn &&
      isRootRoute()
    ) {
      // If all necessary data is obtained, and user is not logged in, and on
      // the root route, redirect immediately to the login page outside
      // the React app, and skip setting the state (so no content blink).
      redirectToLogin();
    } else {
      this.setState(newStateObj);
    }
  }

  /**
   * NOTE: For a new route, follow this guideline:
   * - if route should be accessible to anyone, use `Route`
   * - if route should be accessible only to logged in users, use `AuthProtectedRoute`
   * - if route should be accessible only with given permission, use `PermProtectedRoute`
   * @returns {Node} nested routes
   */
  getRoutes() {
    return (
      <Route name='home' path={ROUTES.ROOT} component={App}>
        <IndexRedirect to={ROUTES.FORMS} />

        {/* MISC */}
        <Route path={ROUTES.SECURITY} component={Security} />
        <Route path={ROUTES.DATA_STORAGE} component={DataStorage} />
        <Route
          path={ROUTES.ACCOUNT_SETTINGS}
          component={AuthProtectedRoute}
          protectedComponent={AccountSettings}
        />
        <Route
          path={ROUTES.CHANGE_PASSWORD}
          component={AuthProtectedRoute}
          protectedComponent={ChangePassword}
        />

        {/* LIBRARY */}
        <Route path={ROUTES.LIBRARY}>
          <IndexRedirect to={ROUTES.MY_LIBRARY}/>
          <Route
            path={ROUTES.MY_LIBRARY}
            component={AuthProtectedRoute}
            protectedComponent={MyLibraryRoute}
          />
          <Route
            path={ROUTES.PUBLIC_COLLECTIONS}
            component={AuthProtectedRoute}
            protectedComponent={PublicCollectionsRoute}
          />
          <Route
            path={ROUTES.NEW_LIBRARY_ITEM}
            component={AuthProtectedRoute}
            protectedComponent={LibraryAssetEditor}
          />
          <Route
            path={ROUTES.LIBRARY_ITEM}
            component={PermProtectedRoute}
            protectedComponent={AssetRoute}
            requiredPermission={PERMISSIONS_CODENAMES.view_asset}
          />
          <Route
            path={ROUTES.EDIT_LIBRARY_ITEM}
            component={PermProtectedRoute}
            protectedComponent={LibraryAssetEditor}
            requiredPermission={PERMISSIONS_CODENAMES.change_asset}
          />
          <Route
            path={ROUTES.NEW_LIBRARY_CHILD}
            component={PermProtectedRoute}
            protectedComponent={LibraryAssetEditor}
            requiredPermission={PERMISSIONS_CODENAMES.change_asset}
          />
          <Route
            path={ROUTES.LIBRARY_ITEM_JSON}
            component={PermProtectedRoute}
            protectedComponent={FormJson}
            requiredPermission={PERMISSIONS_CODENAMES.view_asset}
          />
          <Route
            path={ROUTES.LIBRARY_ITEM_XFORM}
            component={PermProtectedRoute}
            protectedComponent={FormXform}
            requiredPermission={PERMISSIONS_CODENAMES.view_asset}
          />
        </Route>

        {/* FORMS */}
        <Route path={ROUTES.FORMS} >
          <IndexRoute
            component={AuthProtectedRoute}
            protectedComponent={FormsSearchableList}
          />

          <Route path={ROUTES.FORM}>
            <IndexRedirect to={ROUTES.FORM_LANDING} />

            <Route
              path={ROUTES.FORM_SUMMARY}
              component={PermProtectedRoute}
              protectedComponent={FormSummary}
              requiredPermission={PERMISSIONS_CODENAMES.view_submissions}
            />

            <Route
              path={ROUTES.FORM_LANDING}
              component={PermProtectedRoute}
              protectedComponent={FormLanding}
              requiredPermission={PERMISSIONS_CODENAMES.view_asset}
            />

            <Route path={ROUTES.FORM_DATA}>
              <IndexRedirect to={ROUTES.FORM_TABLE} />
              <Route
                path={ROUTES.FORM_REPORT}
                component={PermProtectedRoute}
                protectedComponent={Reports}
                requiredPermission={PERMISSIONS_CODENAMES.view_submissions}
              />
              <Route
                path={ROUTES.FORM_REPORT_OLD}
                component={PermProtectedRoute}
                protectedComponent={FormSubScreens}
                requiredPermission={PERMISSIONS_CODENAMES.view_submissions}
              />
              <Route
                path={ROUTES.FORM_TABLE}
                component={PermProtectedRoute}
                protectedComponent={FormSubScreens}
                requiredPermission={PERMISSIONS_CODENAMES.view_submissions}
              />
              <Route
                path={ROUTES.FORM_DOWNLOADS}
                component={PermProtectedRoute}
                protectedComponent={FormSubScreens}
                requiredPermission={PERMISSIONS_CODENAMES.view_submissions}
              />
              <Route
                path={ROUTES.FORM_GALLERY}
                component={PermProtectedRoute}
                protectedComponent={FormSubScreens}
                requiredPermission={PERMISSIONS_CODENAMES.view_submissions}
              />
              <Route
                path={ROUTES.FORM_MAP}
                component={PermProtectedRoute}
                protectedComponent={FormSubScreens}
                requiredPermission={PERMISSIONS_CODENAMES.view_submissions}
              />
              <Route
                path={ROUTES.FORM_MAP_BY}
                component={PermProtectedRoute}
                protectedComponent={FormSubScreens}
                requiredPermission={PERMISSIONS_CODENAMES.view_submissions}
              />
            </Route>

            <Route path={ROUTES.FORM_SETTINGS}>
              <IndexRoute
                component={PermProtectedRoute}
                protectedComponent={FormSubScreens}
                requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
              />
              <Route
                path={ROUTES.FORM_MEDIA}
                component={PermProtectedRoute}
                protectedComponent={FormSubScreens}
                requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
              />
              <Route
                path={ROUTES.FORM_SHARING}
                component={PermProtectedRoute}
                protectedComponent={FormSubScreens}
                requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
              />
              <Route
                path={ROUTES.FORM_RECORDS}
                component={PermProtectedRoute}
                protectedComponent={FormSubScreens}
                requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
              />
              <Route
                path={ROUTES.FORM_REST}
                component={PermProtectedRoute}
                protectedComponent={FormSubScreens}
                requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
              />
              <Route
                path={ROUTES.FORM_REST_HOOK}
                component={PermProtectedRoute}
                protectedComponent={FormSubScreens}
                requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
              />
              <Route
                path={ROUTES.FORM_KOBOCAT}
                component={PermProtectedRoute}
                protectedComponent={FormSubScreens}
                requiredPermission={PERMISSIONS_CODENAMES.manage_asset}
              />
            </Route>

            <Route
              path={ROUTES.FORM_JSON}
              component={PermProtectedRoute}
              protectedComponent={FormJson}
              requiredPermission={PERMISSIONS_CODENAMES.view_asset}
            />
            <Route
              path={ROUTES.FORM_XFORM}
              component={PermProtectedRoute}
              protectedComponent={FormXform}
              requiredPermission={PERMISSIONS_CODENAMES.view_asset}
            />
            <Route
              path={ROUTES.FORM_EDIT}
              component={PermProtectedRoute}
              protectedComponent={FormPage}
              requiredPermission={PERMISSIONS_CODENAMES.view_asset}
            />

            {/**
              * TODO change this HACKFIX to a better solution
              *
              * Used to force refresh form sub routes. It's some kine of a weird
              * way of introducing a loading screen during sub route refresh.
              **/}
            <Route
              path={ROUTES.FORM_RESET}
              component={PermProtectedRoute}
              protectedComponent={FormSubScreens}
              requiredPermission={PERMISSIONS_CODENAMES.view_submissions}
            />
          </Route>

          <Route path='*' component={FormNotFound} />
        </Route>

        <Route path='*' component={SectionNotFound} />
      </Route>
    );
  }

  render() {
    // This is the place that stops any app rendering until all necessary
    // backend calls are done.
    if (!this.state.isPermsConfigReady || !this.state.isSessionReady) {
      return (<LoadingSpinner/>);
    }

    return (
      <Router
        history={hashHistory}
        ref={(ref) => this.router = ref}
        routes={this.getRoutes()}
      />
    );
  }
}
