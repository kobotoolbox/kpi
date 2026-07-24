/**
 * A component with common layout elements for all routes.
 */
import '#/bemComponents' // importing it so it exists

import { useDisclosure } from '@mantine/hooks'
import React, { useEffect, useState } from 'react'

import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider } from '@tanstack/react-query'
import DocumentTitle from 'react-document-title'
import reactMixin from 'react-mixin'
import { Outlet } from 'react-router-dom'
import { queryClient } from '#/api/queryClient'
import bem from '#/bem'
import Drawer from '#/components/Drawer'
import BigModal from '#/components/bigModal/bigModal'
import FormViewSideTabs from '#/components/formViewSideTabs'
import MainHeader from '#/components/header/mainHeader.component'
import { isAnyProcessingRouteActive } from '#/components/processing/routes.utils'
import mixins from '#/mixins'
import pageState from '#/pageState.store'
import ProjectTopTabs from '#/project/projectTopTabs.component'
import { RootContextProvider } from '#/rootContextProvider.component'
import InvalidatedPassword from '#/router/invalidatedPassword.component'
import {
  getRouteAssetUid,
  isInvalidatedPasswordRouteBlockerActive,
  isTOSAgreementRouteBlockerActive,
} from '#/router/routerUtils'
import TOSAgreement from '#/router/tosAgreement.component'
import { router, withRouter } from './router/legacy'
import { Tracking } from './router/useTracking'
import { cssVariablesResolverKobo, themeKobo } from './theme'
import { KOBO_MODAL_SHARED_PROPS } from './theme/kobo/Modal'
import ToasterConfig from './toasterConfig'

import './api/mutation-defaults'

/**
 * Renders the page necessities (wrapper modifiers, BigModal, header, drawer, content area). Extracted from App because
 * it needs hooks for modal subscription and drawer state.
 */
function AppPageWrapper({ shouldDisplayMain, inFormBuilder, isFormSingle, isLibrarySingle, assetUid }) {
  const [modal, setModal] = useState(() => pageState.state.modal ?? false)
  const [isDrawerOpen, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false)

  // Subscribe to modal state changes.
  useEffect(() => {
    return pageState.listen((state) => setModal(state.modal ?? false))
  }, [])

  // Close the drawer on every route change (better mobile experience).
  useEffect(() => {
    return router.subscribe(() => {
      closeDrawer()
    })
  }, [closeDrawer])

  const pageWrapperContentModifiers = []
  if (isFormSingle) {
    pageWrapperContentModifiers.push('form-landing')
  }
  if (isLibrarySingle) {
    pageWrapperContentModifiers.push('library-landing')
  }

  const pageWrapperModifiers = {
    'fixed-drawer': isDrawerOpen,
    'in-formbuilder': inFormBuilder,
    'is-modal-visible': Boolean(modal),
  }

  if (typeof modal === 'object') {
    pageWrapperModifiers[`is-modal-${modal.type}`] = true
  }

  return (
    <>
      {shouldDisplayMain && <div className='header-stretch-bg' />}

      <bem.PageWrapper m={pageWrapperModifiers} className='mdl-layout mdl-layout--fixed-header'>
        {modal && <BigModal params={modal} />}

        {shouldDisplayMain && (
          <>
            <MainHeader assetUid={assetUid} onToggleMobileMenu={toggleDrawer} />
            <Drawer />
          </>
        )}

        <bem.PageWrapper__content className='mdl-layout__content' m={pageWrapperContentModifiers}>
          {shouldDisplayMain && (
            <>
              {isFormSingle && <ProjectTopTabs />}
              <FormViewSideTabs show={isFormSingle} />
            </>
          )}

          <Outlet />
        </bem.PageWrapper__content>
      </bem.PageWrapper>
    </>
  )
}

class App extends React.Component {
  constructor(props) {
    super(props)
    this.state = {}
  }

  componentDidMount() {
    this.unsubscribeRouter = router.subscribe(this.onRouteChange.bind(this))
  }

  componentWillUnmount() {
    this.unsubscribeRouter?.()
  }

  onRouteChange() {
    // hide modal on every page change
    if (pageState.state.modal) {
      pageState.hideModal()
    }
  }

  /** Whether to display the top header navigation and the side menu. */
  shouldDisplayMainLayoutElements() {
    return (
      // Hide in Form Builder
      !this.isFormBuilder() &&
      // Hide in Single Processing View
      !isAnyProcessingRouteActive()
    )
  }

  render() {
    if (isInvalidatedPasswordRouteBlockerActive()) {
      return <InvalidatedPassword />
    }

    if (isTOSAgreementRouteBlockerActive()) {
      return <TOSAgreement />
    }

    const assetUid = getRouteAssetUid()

    // TODO: We have multiple routes that shouldn't display `MainHeader`,
    // `Drawer`, `ProjectTopTabs` etc. Instead of relying on CSS via
    // `pageWrapperModifiers`, or `show` properties, or JSX logic - we should
    // opt for a more sane, and singluar(!) solution.
    return (
      <DocumentTitle title='KoboToolbox'>
        <QueryClientProvider client={queryClient}>
          <MantineProvider theme={themeKobo} cssVariablesResolver={cssVariablesResolverKobo}>
            <Notifications />
            <ModalsProvider modalProps={KOBO_MODAL_SHARED_PROPS}>
              <RootContextProvider>
                <Tracking />
                <ToasterConfig />

                <AppPageWrapper
                  shouldDisplayMain={this.shouldDisplayMainLayoutElements()}
                  inFormBuilder={this.isFormBuilder()}
                  isFormSingle={this.isFormSingle()}
                  isLibrarySingle={this.isLibrarySingle()}
                  assetUid={assetUid}
                />
              </RootContextProvider>
            </ModalsProvider>
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
    )
  }
}

reactMixin(App.prototype, mixins.contextRouter)

export default withRouter(App)
