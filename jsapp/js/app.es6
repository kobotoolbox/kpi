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
import {stores} from 'js/stores';
import {surveyCompanionStore} from 'js/surveyCompanionStore'; // importing it so it exists
import bem from 'js/bem';
import mixins from 'js/mixins';
import MainHeader from 'js/components/header';
import Drawer from 'js/components/drawer';
import FormViewTabs from 'js/components/formViewTabs';
import IntercomHandler from 'js/components/intercomHandler';
import PermValidator from 'js/components/permissions/permValidator';
import {assign} from 'utils';
import BigModal from 'js/components/bigModal/bigModal';

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = assign({
      pageState: stores.pageState.state,
    });
  }

  componentDidMount() {
    hashHistory.listen(this.onRouteChange.bind(this));
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
              <BigModal params={this.state.pageState.modal} />
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
