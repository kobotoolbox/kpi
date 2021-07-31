/**
 * This is the application wrapper component. It renders all the common layout
 * parts (e.g. navigation)
 */

import React from 'react';
import PropTypes from 'prop-types';
import DocumentTitle from 'react-document-title';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import {hashHistory} from 'react-router';
import {actions} from 'js/actions';
import {stores} from 'js/stores';
import {surveyCompanionStore} from 'js/surveyCompanionStore'; // importing it so it exists
import {bem} from 'js/bem';
import ui from 'js/ui';
import mixins from 'js/mixins';
import MainHeader from 'js/components/header';
import Drawer from 'js/components/drawer';
import FormViewTabs from 'js/components/formViewTabs';
import IntercomHandler from 'js/components/intercomHandler';
import PermValidator from 'js/components/permissions/permValidator';
import Modal from 'js/components/modal';
import {
  assign,
  notify,
} from 'utils';
import permConfig from 'js/components/permissions/permConfig';

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = assign({
      isConfigReady: false,
      pageState: stores.pageState.state,
    });
  }

  componentDidMount() {
    actions.permissions.getConfig.completed.listen(this.onGetConfigCompleted.bind(this));
    actions.permissions.getConfig.failed.listen(this.onGetConfigFailed.bind(this));
    actions.misc.getServerEnvironment();
    actions.permissions.getConfig();
    hashHistory.listen(this.onRouteChange.bind(this));
  }

  onGetConfigCompleted(response) {
    this.setState({isConfigReady: true});
    permConfig.setPermissions(response.results);
  }

  onGetConfigFailed() {
    notify('Failed to get permissions config!', 'error');
  }

  onRouteChange() {
    // slide out drawer overlay on every page change (better mobile experience)
    if (this.state.pageState.showFixedDrawer) {
      stores.pageState.setState({showFixedDrawer: false});
    }

    // hide modal on every page change
    if (this.state.pageState.modal) {
      stores.pageState.hideModal();
    }
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
