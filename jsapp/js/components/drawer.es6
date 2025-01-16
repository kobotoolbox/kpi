import React, {lazy, Suspense} from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import {observer} from 'mobx-react';
import Reflux from 'reflux';
import {NavLink} from 'react-router-dom';
import sessionStore from '../stores/session';
import bem from 'js/bem';
import {searches} from '../searches';
import mixins from '../mixins';
import LibrarySidebar from 'js/components/library/librarySidebar';
import HelpBubble from 'js/components/support/helpBubble';
import {COMMON_QUERIES, MODAL_TYPES} from '../constants';
import {ROUTES, PROJECTS_ROUTES} from 'js/router/routerConstants';
import SidebarFormsList from '../lists/sidebarForms';
import envStore from 'js/envStore';
import {router, routerIsActive, withRouter} from '../router/legacy';
import pageState from 'js/pageState.store';
import {Button} from '@mantine/core';

const AccountSidebar = lazy(() => import('js/account/accountSidebar'));

const INITIAL_STATE = {
  headerFilters: 'forms',
  searchContext: searches.getSearchContext('forms', {
    filterParams: {
      assetType: COMMON_QUERIES.s,
    },
    filterTags: COMMON_QUERIES.s,
  }),
};

const FormSidebar = observer(
  class FormSidebar extends Reflux.Component {
    constructor(props) {
      super(props);
      this.state = Object.assign(
        {
          currentAssetId: false,
          files: [],
        },
        pageState.state
      );
      this.state = Object.assign(INITIAL_STATE, this.state);

      this.unlisteners = [];
      this.stores = [pageState];
      autoBind(this);
    }
    componentDidMount() {
      // NOTE: this causes multiple callbacks being fired when using hot reload
      // in dev environment. Unfortunately `router.subscribe` doesn't return
      // a cancel function, so we can't make it stop.
      // TODO: when refactoring this file, make sure not to use the legacy code.
      this.unlisteners.push(
        router.subscribe(this.onRouteChange.bind(this))
      );
    }
    componentWillUnmount() {
      this.unlisteners.forEach((clb) => {clb();});
    }
    newFormModal(evt) {
      evt.preventDefault();
      pageState.showModal({
        type: MODAL_TYPES.NEW_FORM,
      });
    }
    render() {
      return (
        <>
          <Button
            size='lg'
            fullWidth
            disabled={!sessionStore.isLoggedIn}
            onClick={this.newFormModal.bind(this)}
          >{t('new').toUpperCase()}</Button>

          <SidebarFormsList />
        </>
      );
    }
    onRouteChange() {
      this.setState(INITIAL_STATE);
    }
  }
);

reactMixin(FormSidebar.prototype, searches.common);
reactMixin(FormSidebar.prototype, mixins.droppable);

class DrawerLink extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }
  onClick(evt) {
    if (!this.props.href) {
      evt.preventDefault();
    }
    if (this.props.onClick) {
      this.props.onClick(evt);
    }
  }
  render() {
    const icon = <i className={`k-icon-${this.props['k-icon']}`} />;
    const classNames = [this.props.class, 'k-drawer__link'];

    let link;
    if (this.props.linkto) {
      link = (
        <NavLink
          to={this.props.linkto}
          className={classNames.join(' ')}
          data-tip={this.props.label}
        >
          {icon}
        </NavLink>
      );
    } else {
      link = (
        <a
          href={this.props.href || '#'}
          className={classNames.join(' ')}
          onClick={this.onClick}
          data-tip={this.props.label}
        >
          {icon}
        </a>
      );
    }
    return link;
  }
}

const Drawer = observer(
  class Drawer extends Reflux.Component {
    constructor(props) {
      super(props);
      autoBind(this);
      this.stores = [pageState];
    }

    isAccount() {
      return routerIsActive(ROUTES.ACCOUNT_ROOT);
    }

    render() {
      // no sidebar for not logged in users
      if (!sessionStore.isLoggedIn) {
        return null;
      }

      return (
        <bem.KDrawer>
          <bem.KDrawer__primaryIcons>
            <DrawerLink
              label={t('Projects')}
              linkto={PROJECTS_ROUTES.MY_PROJECTS}
              k-icon='projects'
            />
            <DrawerLink
              label={t('Library')}
              linkto={ROUTES.LIBRARY}
              k-icon='library'
            />
          </bem.KDrawer__primaryIcons>

          <bem.KDrawer__sidebar>
            {this.isLibrary() && (
              <bem.FormSidebarWrapper>
                <LibrarySidebar />
              </bem.FormSidebarWrapper>
            )}

            {this.isAccount() && (
              <Suspense fallback={null}>
                <AccountSidebar />
              </Suspense>
            )}

            {!this.isLibrary() && !this.isAccount() && (
              <bem.FormSidebarWrapper>
                <FormSidebar />
              </bem.FormSidebarWrapper>
            )}
          </bem.KDrawer__sidebar>

          <bem.KDrawer__secondaryIcons>
            {sessionStore.isLoggedIn && <HelpBubble />}
            {envStore.isReady && envStore.data.source_code_url && (
              <a
                href={envStore.data.source_code_url}
                className='k-drawer__link'
                target='_blank'
                data-tip={t('Source')}
              >
                <i className='k-icon k-icon-logo-github' />
              </a>
            )}
          </bem.KDrawer__secondaryIcons>
        </bem.KDrawer>
      );
    }
  }
);

reactMixin(Drawer.prototype, searches.common);
reactMixin(Drawer.prototype, mixins.droppable);
reactMixin(Drawer.prototype, mixins.contextRouter);

export default withRouter(Drawer);
