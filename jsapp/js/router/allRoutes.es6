import React from 'react';
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
import {envStore} from 'js/envStore'; // initializing it
import MyLibraryRoute from 'js/components/library/myLibraryRoute';
import PublicCollectionsRoute from 'js/components/library/publicCollectionsRoute';
import AssetRoute from 'js/components/library/assetRoute';
import Reports from 'js/components/reports/reports';
import FormLanding from 'js/components/formLanding';
import FormSummary from 'js/components/formSummary';
import FormSubScreens from 'js/components/formSubScreens';
import AccountSettings from 'js/components/accountSettings';
import ChangePassword from 'js/components/changePassword';
import SectionNotFound from 'js/components/sectionNotFound';
import FormNotFound from 'js/components/formNotFound';
import FormXform from 'js/components/formXform';
import FormJson from 'js/components/formJson';
import FormsSearchableList from 'js/lists/forms';
import {ROUTES} from 'js/router/routerConstants';
import permConfig from 'js/components/permissions/permConfig';
import LoadingSpinner from 'js/components/common/loadingSpinner';

export default class AllRoutes extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isPermsConfigReady: false,
    };
  }

  componentDidMount() {
    actions.permissions.getConfig.completed.listen(this.onGetConfigCompleted.bind(this));
    actions.permissions.getConfig();
  }

  onGetConfigCompleted(response) {
    permConfig.setPermissions(response.results);
    this.setState({isPermsConfigReady: true});
  }

  getRoutes() {
    return (
      <Route name='home' path='/' component={App}>
        <IndexRedirect to={ROUTES.FORMS} />

        {/* MISC */}
        <Route path={ROUTES.ACCOUNT_SETTINGS} component={AccountSettings} />
        <Route path={ROUTES.CHANGE_PASSWORD} component={ChangePassword} />

        {/* LIBRARY */}
        <Route path={ROUTES.LIBRARY}>
          <IndexRedirect to={ROUTES.MY_LIBRARY}/>
          <Route path={ROUTES.MY_LIBRARY} component={MyLibraryRoute}/>
          <Route path={ROUTES.PUBLIC_COLLECTIONS} component={PublicCollectionsRoute}/>
          <Route path={ROUTES.NEW_LIBRARY_ITEM} component={LibraryAssetEditor}/>
          <Route path={ROUTES.LIBRARY_ITEM} component={AssetRoute}/>
          <Route path={ROUTES.EDIT_LIBRARY_ITEM} component={LibraryAssetEditor}/>
          <Route path={ROUTES.NEW_LIBRARY_CHILD} component={LibraryAssetEditor}/>
          <Route path={ROUTES.LIBRARY_ITEM_JSON} component={FormJson}/>
          <Route path={ROUTES.LIBRARY_ITEM_XFORM} component={FormXform}/>
        </Route>

        {/* FORMS */}
        <Route path={ROUTES.FORMS} >
          <IndexRoute component={FormsSearchableList} />

          <Route path={ROUTES.FORM}>
            <IndexRedirect to={ROUTES.FORM_LANDING} />

            <Route path={ROUTES.FORM_JSON} component={FormJson} />
            <Route path={ROUTES.FORM_XFORM} component={FormXform} />
            <Route path={ROUTES.FORM_EDIT} component={FormPage} />

            <Route path={ROUTES.FORM_SUMMARY}>
              <IndexRoute component={FormSummary} />
            </Route>

            <Route path={ROUTES.FORM_LANDING}>
              <IndexRoute component={FormLanding} />
            </Route>

            <Route path={ROUTES.FORM_DATA}>
              <IndexRedirect to={ROUTES.FORM_TABLE} />
              <Route path={ROUTES.FORM_REPORT} component={Reports} />
              <Route path={ROUTES.FORM_REPORT_OLD} component={FormSubScreens} />
              <Route path={ROUTES.FORM_TABLE} component={FormSubScreens} />
              <Route path={ROUTES.FORM_DOWNLOADS} component={FormSubScreens} />
              <Route path={ROUTES.FORM_GALLERY} component={FormSubScreens} />
              <Route path={ROUTES.FORM_MAP} component={FormSubScreens} />
              <Route path={ROUTES.FORM_MAP_BY} component={FormSubScreens} />
            </Route>

            <Route path={ROUTES.FORM_SETTINGS}>
              <IndexRoute component={FormSubScreens} />
              <Route path={ROUTES.FORM_MEDIA} component={FormSubScreens} />
              <Route path={ROUTES.FORM_SHARING} component={FormSubScreens} />
              <Route path={ROUTES.FORM_RECORDS} component={FormSubScreens} />
              <Route path={ROUTES.FORM_REST} component={FormSubScreens} />
              <Route path={ROUTES.FORM_REST_HOOK} component={FormSubScreens} />
              <Route path={ROUTES.FORM_KOBOCAT} component={FormSubScreens} />
            </Route>

            {/**
              * TODO change this HACKFIX to a better solution
              *
              * Used to force refresh form sub routes. It's some kine of a weird
              * way of introducing a loading screen during sub route refresh.
              **/}
            <Route path={ROUTES.FORM_RESET} component={FormSubScreens} />
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
    if (!this.state.isPermsConfigReady) {
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
