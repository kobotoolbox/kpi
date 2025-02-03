/**
 * A component with common layout elements for all routes.
 */

import React from 'react';
import DocumentTitle from 'react-document-title';
import {Outlet} from 'react-router-dom';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import 'js/surveyCompanionStore'; // importing it so it exists
import {} from 'js/bemComponents'; // importing it so it exists
import bem from 'js/bem';
import mixins from 'js/mixins';
import MainHeader from 'js/components/header/mainHeader.component';
import Drawer from 'js/components/drawer';
import FormViewSideTabs from 'js/components/formViewSideTabs';
import ProjectTopTabs from 'js/project/projectTopTabs.component';
import BigModal from 'js/components/bigModal/bigModal';
import ToasterConfig from './toasterConfig';
import {withRouter, routerGetAssetId, router} from './router/legacy';
import {Tracking} from './router/useTracking';
import InvalidatedPassword from 'js/router/invalidatedPassword.component';
import {RootContextProvider} from 'js/rootContextProvider.component';
import TOSAgreement from 'js/router/tosAgreement.component';
import {
  isInvalidatedPasswordRouteBlockerActive,
  isTOSAgreementRouteBlockerActive,
} from 'js/router/routerUtils';
import {isAnyProcessingRouteActive} from 'js/components/processing/routes.utils';
import pageState from 'js/pageState.store';

import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';

// Query-related
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './query/queryClient.ts';
import { RequireOrg } from './router/RequireOrg';
import { themeKobo } from './theme';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = Object.assign({
      pageState: pageState.state,
    });
  }

  componentDidMount() {
    router.subscribe(this.onRouteChange.bind(this));
  }

  onRouteChange() {
    // slide out drawer overlay on every page change (better mobile experience)
    if (this.state.pageState.showFixedDrawer) {
      pageState.setState({showFixedDrawer: false});
    }

    // hide modal on every page change
    if (this.state.pageState.modal) {
      pageState.hideModal();
    }
  }

  /** Whether to display the top header navigation and the side menu. */
  shouldDisplayMainLayoutElements() {
    return (
      // Hide in Form Builder
      !this.isFormBuilder() &&
      // Hide in Single Processing View
      !isAnyProcessingRouteActive()
    );
  }

  render() {
    if (isInvalidatedPasswordRouteBlockerActive()) {
      return <InvalidatedPassword />;
    }

    if (isTOSAgreementRouteBlockerActive()) {
      return <TOSAgreement />;
    }

    const assetid = routerGetAssetId();

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
      pageWrapperModifiers[
        `is-modal-${this.state.pageState.modal.type}`
      ] = true;
    }

    // TODO: We have multiple routes that shouldn't display `MainHeader`,
    // `Drawer`, `ProjectTopTabs` etc. Instead of relying on CSS via
    // `pageWrapperModifiers`, or `show` properties, or JSX logic - we should
    // opt for a more sane, and singluar(!) solution.
    return (
      <DocumentTitle title='KoboToolbox'>
        <QueryClientProvider client={queryClient}>
          <MantineProvider theme={themeKobo}>
            <RootContextProvider>
              <RequireOrg>
                <Tracking />
                <ToasterConfig />

                {this.shouldDisplayMainLayoutElements() &&
                  <div className='header-stretch-bg' />
                }

                <bem.PageWrapper
                  m={pageWrapperModifiers}
                  className='mdl-layout mdl-layout--fixed-header'
                >
                  {this.state.pageState.modal && (
                    <BigModal params={this.state.pageState.modal} />
                  )}

                  {this.shouldDisplayMainLayoutElements() && (
                    <>
                      <MainHeader assetUid={assetid} />
                      <Drawer />
                    </>
                  )}

                  <bem.PageWrapper__content
                    className='mdl-layout__content'
                    m={pageWrapperContentModifiers}
                  >
                    {this.shouldDisplayMainLayoutElements() && (
                      <>
                        {this.isFormSingle() && <ProjectTopTabs />}
                        <FormViewSideTabs show={this.isFormSingle()} />
                      </>
                    )}

                    <Outlet />
                  </bem.PageWrapper__content>
                </bem.PageWrapper>
              </RequireOrg>
            </RootContextProvider>
          </MantineProvider>


          {/* React Query Devtools - GUI for inspecting and modifying query status
              (https://tanstack.com/query/latest/docs/framework/react/devtools)
              They only show up in dev server (NODE_ENV==='development')
              Additionally, we're keeping them commented out in `beta`
              (https://github.com/kobotoolbox/kpi/pull/5001#discussion_r1691067344)
                (1) Uncomment if you want to use these tools
                (2) The <style> tag lowers the toggle button opacity
                    to make it less prominent in dev screenshots. */}
          {/*
            <style>{'.tsqd-open-btn-container { opacity: 0.1 !important; };'}</style>
            <ReactQueryDevtools />
          */}


        </QueryClientProvider>
      </DocumentTitle>
    );
  }
}


reactMixin(App.prototype, Reflux.connect(pageState, 'pageState'));
reactMixin(App.prototype, mixins.contextRouter);

export default withRouter(App);
