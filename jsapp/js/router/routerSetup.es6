import React from 'react';
import {
  IndexRoute,
  IndexRedirect,
  Route,
  hashHistory,
  Router,
} from 'react-router';
import App from './app';
import {
  FormPage,
  LibraryAssetEditor,
} from './components/formEditors';
import MyLibraryRoute from 'js/components/library/myLibraryRoute';
import PublicCollectionsRoute from 'js/components/library/publicCollectionsRoute';
import AssetRoute from 'js/components/library/assetRoute';
import Reports from './components/reports/reports';
import FormLanding from './components/formLanding';
import FormSummary from './components/formSummary';
import FormSubScreens from './components/formSubScreens';
import AccountSettings from './components/accountSettings';
import ChangePassword from './components/changePassword';
import SectionNotFound from './components/sectionNotFound';
import FormNotFound from './components/formNotFound';
import FormXform from './components/formXform';
import FormJson from './components/formJson';
import FormsSearchableList from './lists/forms';
import {ROUTES} from 'js/constants';

export var routes = (
  <Route name='home' path='/' component={App}>
    <Route path={ROUTES.ACCOUNT_SETTINGS} component={AccountSettings} />
    <Route path={ROUTES.CHANGE_PASSWORD} component={ChangePassword} />

    <Route path={ROUTES.LIBRARY}>
      <Route path={ROUTES.MY_LIBRARY} component={MyLibraryRoute}/>
      <Route path={ROUTES.PUBLIC_COLLECTIONS} component={PublicCollectionsRoute}/>
      <Route path={ROUTES.NEW_LIBRARY_ITEM} component={LibraryAssetEditor}/>
      <Route path={ROUTES.LIBRARY_ITEM} component={AssetRoute}/>
      <Route path={ROUTES.EDIT_LIBRARY_ITEM} component={LibraryAssetEditor}/>
      <Route path={ROUTES.NEW_LIBRARY_CHILD} component={LibraryAssetEditor}/>
      <Route path={ROUTES.LIBRARY_ITEM_JSON} component={FormJson}/>
      <Route path={ROUTES.LIBRARY_ITEM_XFORM} component={FormXform}/>
      <IndexRedirect to={ROUTES.MY_LIBRARY}/>
    </Route>

    <IndexRedirect to={ROUTES.FORMS} />
    <Route path={ROUTES.FORMS} >
      <IndexRoute component={FormsSearchableList} />

      <Route path={ROUTES.FORM}>
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
          <Route path={ROUTES.FORM_REPORT} component={Reports} />
          <Route path={ROUTES.FORM_REPORT_OLD} component={FormSubScreens} />
          <Route path={ROUTES.FORM_TABLE} component={FormSubScreens} />
          <Route path={ROUTES.FORM_DOWNLOADS} component={FormSubScreens} />
          <Route path={ROUTES.FORM_GALLERY} component={FormSubScreens} />
          <Route path={ROUTES.FORM_MAP} component={FormSubScreens} />
          <Route path={ROUTES.FORM_MAP_BY} component={FormSubScreens} />
          <IndexRedirect to={ROUTES.FORM_TABLE} />
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

        <IndexRedirect to={ROUTES.FORM_LANDING} />
      </Route>

      <Route path='*' component={FormNotFound} />
    </Route>

    <Route path='*' component={SectionNotFound} />
  </Route>
);

export default class RunRoutes extends React.Component {
  componentDidMount(){
    // HACK: when hot reloading, componentWillReceiveProps whines about
    // changing the routes prop so this shuts that up
    this.router.componentWillReceiveProps = function () {};
  }

  render() {
    return (
      <Router
        history={hashHistory}
        ref={(ref) => this.router = ref}
        routes={this.props.routes}
      />
    );
  }
}
