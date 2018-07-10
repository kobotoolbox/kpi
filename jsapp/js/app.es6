import $ from 'jquery';
window.jQuery = $;
window.$ = $;
require('jquery-ui/ui/widgets/sortable');

import React from 'react';
import ReactDOM from 'react-dom';

import PropTypes from 'prop-types';
import classNames from 'classnames';
import DocumentTitle from 'react-document-title';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';

import {
  IndexRoute,
  IndexRedirect,
  Link,
  Route,
  hashHistory,
  Router
} from 'react-router';

import Select from 'react-select';
import moment from 'moment';

import actions from './actions';

import stores from './stores';
import {dataInterface} from './dataInterface';
import bem from './bem';
import ui from './ui';
import mixins from './mixins';
import MainHeader from './components/header';
import Drawer from './components/drawer';
import {
  AddToLibrary,
  FormPage,
  LibraryPage
} from './components/formEditors';

import Reports from './components/reports';
import FormLanding from './components/formLanding';
import FormSummary from './components/formSummary';
import FormSubScreens from './components/formSubScreens';
import FormViewTabs from './components/formViewTabs';
import Modal from './components/modal';
import {ChangePassword, AccountSettings} from './components/accountSettings';

import {
  getAnonymousUserPermission,
  anonUsername,
  log,
  t,
  assign,
  currentLang
} from './utils';

import keymap from './keymap'
import { ShortcutManager, Shortcuts } from 'react-shortcuts'
const shortcutManager = new ShortcutManager(keymap)


function stringifyRoutes(contextRouter) {
  return JSON.stringify(contextRouter.getCurrentRoutes().map(function(r){
    return {
      name: r.name,
      href: r.path
    };
  }), null, 4);
}

class App extends React.Component {
  constructor(props) {
    super(props);
    moment.locale(currentLang());
    this.state = assign({
      pageState: stores.pageState.state
    });
  }
  componentWillReceiveProps() {
    // slide out drawer overlay on every page change (better mobile experience)
    if (this.state.pageState.showFixedDrawer)
      stores.pageState.setState({showFixedDrawer: false});
    // hide modal on every page change
    if (this.state.pageState.modal)
      stores.pageState.hideModal();
  }
  componentDidMount () {
    actions.misc.getServerEnvironment();
  }
  _handleShortcuts(action) {
    switch (action) {
      case 'EDGE':
        document.body.classList.toggle('hide-edge')
        break
      case 'CLOSE_MODAL':
        stores.pageState.hideModal()
        break
    }
  }
  getChildContext() {
    return { shortcuts: shortcutManager }
  }
  render() {
    var assetid = this.props.params.assetid || null;
    return (
      <DocumentTitle title="KoBoToolbox">
        <Shortcuts
          name='APP_SHORTCUTS'
          handler={this._handleShortcuts}
          className="mdl-wrapper"
          global
          isolate>

          { !this.isFormBuilder() && !this.state.pageState.headerHidden &&
            <div className="k-header__bar" />
          }
          <bem.PageWrapper m={{
              'fixed-drawer': this.state.pageState.showFixedDrawer,
              'header-hidden': this.state.pageState.headerHidden,
              'drawer-hidden': this.state.pageState.drawerHidden,
              'in-formbuilder': this.isFormBuilder()
                }} className="mdl-layout mdl-layout--fixed-header">
              { this.state.pageState.modal &&
                <Modal params={this.state.pageState.modal} />
              }

              { !this.isFormBuilder() && !this.state.pageState.headerHidden &&
                <MainHeader assetid={assetid}/>
              }
              { !this.isFormBuilder() && !this.state.pageState.drawerHidden &&
                <Drawer/>
              }
              <bem.PageWrapper__content className='mdl-layout__content' m={this.isFormSingle() ? 'form-landing' : ''}>
                { !this.isFormBuilder() &&
                  <FormViewTabs type={'top'} show={this.isFormSingle()} />
                }
                { !this.isFormBuilder() &&
                  <FormViewTabs type={'side'} show={this.isFormSingle()} />
                }
                {this.props.children}

              </bem.PageWrapper__content>
          </bem.PageWrapper>
        </Shortcuts>
      </DocumentTitle>
    );
  }
};

App.contextTypes = {
  router: PropTypes.object
};

App.childContextTypes = {
  shortcuts: PropTypes.object.isRequired
}

reactMixin(App.prototype, Reflux.connect(stores.pageState, 'pageState'));
reactMixin(App.prototype, mixins.contextRouter);

class FormJson extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      assetcontent: false
    };
    autoBind(this);
  }
  componentDidMount () {
    this.listenTo(stores.asset, this.assetStoreTriggered);
    actions.resources.loadAsset({id: this.props.params.assetid});

  }
  assetStoreTriggered (data, uid) {
    this.setState({
      assetcontent: data[uid].content
    });
  }
  render () {
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
};

reactMixin(FormJson.prototype, Reflux.ListenerMixin);

class FormXform extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      xformLoaded: false
    };
  }
  componentDidMount () {
    dataInterface.getAssetXformView(this.props.params.assetid).done((content)=>{
      this.setState({
        xformLoaded: true,
        xformHtml: {
          __html: $('<div>').html(content).find('.pygment').html()
        },
      });
    });
  }
  render () {
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
            <div className="pygment" dangerouslySetInnerHTML={this.state.xformHtml} />
          </bem.FormView>
        </ui.Panel>
        );
    }
  }
};

var LibrarySearchableList = require('./lists/library');
var FormsSearchableList = require('./lists/forms');

class FormNotFound extends React.Component {
  render () {
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
};

class SectionNotFound extends React.Component {
  render () {
    return (
        <ui.Panel className="k404">
          <i />
          <em>section not found</em>
        </ui.Panel>
      );
  }
};

export var routes = (
  <Route name="home" path="/" component={App}>
    <Route path="account-settings" component={AccountSettings} />
    <Route path="change-password" component={ChangePassword} />

    <Route path="library" >
      <Route path="new" component={AddToLibrary} />
      <Route path="/library/:assetid">
        {/*<Route name="library-form-download" path="download" handler={FormDownload} />,*/}
        <Route path="json" component={FormJson} />,
        <Route path="xform" component={FormXform} />,
        <Route path="edit" component={LibraryPage} />
      </Route>
      <IndexRoute component={LibrarySearchableList} />
    </Route>

    <IndexRedirect to="forms" />
    <Route path="forms" >
      <IndexRoute component={FormsSearchableList} />

      <Route path="/forms/:assetid">
        {/*<Route name="form-download" path="download" component={FormDownload} />*/}
        <Route path="json" component={FormJson} />
        <Route path="xform" component={FormXform} />
        <Route path="edit" component={FormPage} />

        <Route path="summary">
          <IndexRoute component={FormSummary} />
        </Route>

        <Route path="landing">
          <IndexRoute component={FormLanding} />
        </Route>

        <Route path="data">
          <Route path="report" component={Reports} />
          <Route path="report-legacy" component={FormSubScreens} />
          <Route path="table" component={FormSubScreens} />
          <Route path="downloads" component={FormSubScreens} />
          <Route path="gallery" component={FormSubScreens} />
          <Route path="map" component={FormSubScreens} />
          <Route path="map/:viewby" component={FormSubScreens} />
          <IndexRedirect to="report" />
        </Route>

        <Route path="settings">
          <IndexRoute component={FormSubScreens} />
          <Route path="kobocat" component={FormSubScreens} />
          <Route path="sharing" component={FormSubScreens} />
        </Route>

        {/* used to force refresh form screens */}
        <Route path="reset" component={FormSubScreens} />

        <IndexRedirect to="landing" />
      </Route>

      <Route path="*" component={FormNotFound} />
    </Route>

    <Route path="*" component={SectionNotFound} />
  </Route>
);

/* Send a pageview to Google Analytics for every change in routes */
hashHistory.listen(function(loc) {
  if (typeof ga == 'function') {
    ga('send', 'pageview', window.location.hash);
  }
});

class RunRoutes extends React.Component {
  componentDidMount(){
    // when hot reloading, componentWillReceiveProps whines about changing the routes prop so this shuts that up
    this.router.componentWillReceiveProps = function(){}
  }

  render() {
    return (
      <Router history={hashHistory} ref={ref=>this.router = ref} routes={this.props.routes} />
    );
  }
}

export default RunRoutes;
