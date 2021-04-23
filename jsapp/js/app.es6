/**
 * The React application used in `jsapp/js/main.es6` bundle file.
 *
 * TODO: move routes configuration to separate file for clarity.
 */

require('jquery-ui/ui/widgets/sortable');
import React from 'react';
import PropTypes from 'prop-types';
import DocumentTitle from 'react-document-title';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {
  IndexRoute,
  IndexRedirect,
  Route,
  hashHistory,
  Router,
} from 'react-router';
import moment from 'moment';
import {actions} from './actions';
import {stores} from './stores';
import {surveyCompanionStore} from './surveyCompanionStore'; // importing it so it exists
import {alertify} from './alertify'; // importing it so it exists
import {dataInterface} from './dataInterface';
import {bem} from './bem';
import ui from './ui';
import mixins from './mixins';
import MainHeader from './components/header';
import Drawer from './components/drawer';
import {
  FormPage,
  LibraryAssetEditor,
} from './components/formEditors';
import MyLibraryRoute from 'js/components/library/myLibraryRoute';
import PublicCollectionsRoute from 'js/components/library/publicCollectionsRoute';
import AssetRoute from 'js/components/library/assetRoute';
import Reports from './components/reports';
import FormLanding from './components/formLanding';
import FormSummary from './components/formSummary';
import FormSubScreens from './components/formSubScreens';
import FormViewTabs from './components/formViewTabs';
import IntercomHandler from './components/intercomHandler';
import PermValidator from './components/permissions/permValidator';
import Modal from './components/modal';
import AccountSettings from './components/accountSettings';
import ChangePassword from './components/changePassword';
import {
  assign,
  notify,
  currentLang,
} from 'utils';
import FormsSearchableList from './lists/forms';
import permConfig from 'js/components/permissions/permConfig';
import {ROUTES} from 'js/constants';

class App extends React.Component {
  constructor(props) {
    super(props);
    moment.locale(currentLang());
    this.state = assign({
      isConfigReady: false,
      pageState: stores.pageState.state,
    });
  }
  componentWillReceiveProps() {
    // slide out drawer overlay on every page change (better mobile experience)
    if (this.state.pageState.showFixedDrawer) {
      stores.pageState.setState({showFixedDrawer: false});
    }
    // hide modal on every page change
    if (this.state.pageState.modal) {
      stores.pageState.hideModal();
    }
  }
  componentDidMount() {
    this.listenTo(actions.permissions.getConfig.completed, this.onGetConfigCompleted);
    this.listenTo(actions.permissions.getConfig.failed, this.onGetConfigFailed);
    actions.misc.getServerEnvironment();
    actions.permissions.getConfig();
  }
  onGetConfigCompleted(response) {
    this.setState({isConfigReady: true});
    permConfig.setPermissions(response.results);
  }
  onGetConfigFailed() {
    notify('Failed to get permissions config!', 'error');
  }
  render() {
    if (!this.state.isConfigReady) {
      return (<ui.LoadingSpinner/>);
    }

    var assetid = this.props.params.assetid || this.props.params.uid || null;

    const pageWrapperContentModifiers = [];
    if (this.isFormSingle()) {
      pageWrapperContentModifiers.push('form-landing');
    }
    if (this.isLibrarySingle()) {
      pageWrapperContentModifiers.push('library-landing');
    }

    const pageWrapperModifiers = {
      'fixed-drawer': this.state.pageState.showFixedDrawer,
      'in-formbuilder': this.isFormBuilder(),
      'is-modal-visible': Boolean(this.state.pageState.modal),
    };

    if (typeof this.state.pageState.modal === 'object') {
      pageWrapperModifiers[`is-modal-${this.state.pageState.modal.type}`] = true;
    }

    return (
      <DocumentTitle title='KoBoToolbox'>
        <React.Fragment>
          <PermValidator/>
          <IntercomHandler/>
          <div className='header-stretch-bg'/>
          <bem.PageWrapper m={pageWrapperModifiers} className='mdl-layout mdl-layout--fixed-header'>
            { this.state.pageState.modal &&
              <Modal params={this.state.pageState.modal} />
            }

            { !this.isFormBuilder() &&
              <React.Fragment>
                <MainHeader assetid={assetid}/>
                <Drawer/>
              </React.Fragment>
            }

            <bem.PageWrapper__content className='mdl-layout__content' m={pageWrapperContentModifiers}>
              { !this.isFormBuilder() &&
                <React.Fragment>
                  <FormViewTabs type={'top'} show={this.isFormSingle()} />
                  <FormViewTabs type={'side'} show={this.isFormSingle()} />
                </React.Fragment>
              }
              {this.props.children}
            </bem.PageWrapper__content>
          </bem.PageWrapper>
        </React.Fragment>
      </DocumentTitle>
    );
  }
}

App.contextTypes = {router: PropTypes.object};

reactMixin(App.prototype, Reflux.connect(stores.pageState, 'pageState'));
reactMixin(App.prototype, mixins.contextRouter);

class FormJson extends React.Component {
  constructor(props) {
    super(props);
    this.state = {assetcontent: false};
    autoBind(this);
  }
  componentDidMount() {
    this.listenTo(stores.asset, this.assetStoreTriggered);
    const uid = this.props.params.assetid || this.props.params.uid;
    actions.resources.loadAsset({id: uid});

  }
  assetStoreTriggered(data, uid) {
    this.setState({assetcontent: data[uid].content});
  }
  render() {
    return (
        <ui.Panel>
          <bem.FormView>
            <pre>
            <code>
              { this.state.assetcontent ?
                JSON.stringify(this.state.assetcontent, null, 4)
                : null }
            </code>
            </pre>
          </bem.FormView>
        </ui.Panel>
      );
  }
}

reactMixin(FormJson.prototype, Reflux.ListenerMixin);

class FormXform extends React.Component {
  constructor(props) {
    super(props);
    this.state = {xformLoaded: false};
  }
  componentDidMount() {
    const uid = this.props.params.assetid || this.props.params.uid;
    dataInterface.getAssetXformView(uid).done((content) => {
      this.setState({
        xformLoaded: true,
        xformHtml: {__html: $('<div>').html(content).find('.pygment').html()},
      });
    });
  }
  render() {
    if (!this.state.xformLoaded) {
      return (
        <ui.Panel>
          <bem.Loading>
            <bem.Loading__inner>
              <p>XForm is loading</p>
            </bem.Loading__inner>
          </bem.Loading>
        </ui.Panel>

        );
    } else {
      return (
        <ui.Panel>
          <bem.FormView>
            <div className='pygment' dangerouslySetInnerHTML={this.state.xformHtml} />
          </bem.FormView>
        </ui.Panel>
        );
    }
  }
}

class FormNotFound extends React.Component {
  render() {
    return (
        <ui.Panel>
          <bem.Loading>
            <bem.Loading__inner>
              {t('path not found / recognized')}
            </bem.Loading__inner>
          </bem.Loading>
        </ui.Panel>
      );
  }
}

class SectionNotFound extends React.Component {
  render() {
    return (
        <ui.Panel className='k404'>
          <i />
          <em>section not found</em>
        </ui.Panel>
      );
  }
}

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
          <IndexRedirect to={ROUTES.FORM_REPORT} />
        </Route>

        <Route path={ROUTES.FORM_SETTINGS}>
          <IndexRoute component={FormSubScreens} />
          <Route path={ROUTES.FORM_MEDIA} component={FormSubScreens} />
          <Route path={ROUTES.FORM_SHARING} component={FormSubScreens} />
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

/* Send a pageview to Google Analytics for every change in routes */
hashHistory.listen(function() {
  if (typeof ga === 'function') {
    ga('send', 'pageview', window.location.hash);
  }
});

export default class RunRoutes extends React.Component {
  componentDidMount(){
    // when hot reloading, componentWillReceiveProps whines about changing the routes prop so this shuts that up
    this.router.componentWillReceiveProps = function(){};
  }

  render() {
    return (
      <Router history={hashHistory} ref={(ref) => {return this.router = ref;}} routes={this.props.routes} />
    );
  }
}
