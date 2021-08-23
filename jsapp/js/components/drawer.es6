import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import { Link, hashHistory } from 'react-router';
import {stores} from '../stores';
import bem from 'js/bem';
import {searches} from '../searches';
import mixins from '../mixins';
import LibrarySidebar from 'js/components/library/librarySidebar';
import {
  IntercomHelpBubble,
  SupportHelpBubble,
} from '../components/helpBubbles';
import {
  COMMON_QUERIES,
  MODAL_TYPES,
} from '../constants';
import {ROUTES} from 'js/router/routerConstants';
import {assign} from 'utils';
import SidebarFormsList from '../lists/sidebarForms';
import envStore from 'js/envStore';

const INITIAL_STATE = {
  headerFilters: 'forms',
  searchContext: searches.getSearchContext('forms', {
    filterParams: {
      assetType: COMMON_QUERIES.s,
    },
    filterTags: COMMON_QUERIES.s,
  })
};

class FormSidebar extends Reflux.Component {
  constructor(props){
    super(props);
    this.state = assign({
      currentAssetId: false,
      files: []
    }, stores.pageState.state);
    this.state = assign(INITIAL_STATE, this.state);

    this.stores = [
      stores.session,
      stores.pageState
    ];
    this.unlisteners = [];
    autoBind(this);
  }
  componentDidMount() {
    this.unlisteners.push(
      hashHistory.listen(this.onRouteChange.bind(this))
    );
  }
  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }
  newFormModal (evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: MODAL_TYPES.NEW_FORM
    });
  }
  render() {
    return (
      <React.Fragment>
        <bem.KoboButton
          m={['blue', 'fullwidth']}
          disabled={!stores.session.isLoggedIn}
          onClick={this.newFormModal}
        >
          {t('new')}
        </bem.KoboButton>
        <SidebarFormsList/>
      </React.Fragment>
    );
  }
  onRouteChange() {
    this.setState(INITIAL_STATE);
  }
}

FormSidebar.contextTypes = {
  router: PropTypes.object
};

reactMixin(FormSidebar.prototype, searches.common);
reactMixin(FormSidebar.prototype, mixins.droppable);

class DrawerLink extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }
  onClick (evt) {
    if (!this.props.href) {
      evt.preventDefault();
    }
    if (this.props.onClick) {
      this.props.onClick(evt);
    }
  }
  render () {
    var icon = (<i className={`k-icon-${this.props['k-icon']}`}/>);
    var classNames = [this.props.class, 'k-drawer__link'];

    var link;
    if (this.props.linkto) {
      link = (
        <Link to={this.props.linkto}
            className={classNames.join(' ')}
            activeClassName='active'
            data-tip={this.props.label}>
          {icon}
        </Link>
      );
    } else {
      link = (
        <a href={this.props.href || '#'}
            className={classNames.join(' ')}
            onClick={this.onClick}
            data-tip={this.props.label}>
            {icon}
        </a>
      );
    }
    return link;
  }
}

class Drawer extends Reflux.Component {
  constructor(props){
    super(props);
    autoBind(this);
    this.stores = [
      stores.session,
      stores.pageState,
    ];
  }
  render() {
    // no sidebar for not logged in users
    if (!stores.session.isLoggedIn) {
      return null;
    }

    return (
      <bem.KDrawer>
        <bem.KDrawer__primaryIcons>
          <DrawerLink label={t('Projects')} linkto={ROUTES.FORMS} k-icon='projects' />
          <DrawerLink label={t('Library')} linkto={ROUTES.LIBRARY} k-icon='library' />
        </bem.KDrawer__primaryIcons>

        <bem.KDrawer__sidebar>
          { this.isLibrary()
            ? <LibrarySidebar />
            : <FormSidebar />
          }
        </bem.KDrawer__sidebar>

        <bem.KDrawer__secondaryIcons>
          { stores.session.isLoggedIn &&
            <IntercomHelpBubble/>
          }
          { stores.session.isLoggedIn &&
            <SupportHelpBubble/>
          }
          { stores.session.isLoggedIn &&
            stores.session.currentAccount.projects_url &&
            <a href={stores.session.currentAccount.projects_url}
              className='k-drawer__link'
              target='_blank'
              data-tip={t('Projects (legacy)')}
            >
              <i className='k-icon k-icon-globe' />
            </a>
          }
          { envStore.isReady &&
            envStore.data.source_code_url &&
            <a href={envStore.data.source_code_url}
              className='k-drawer__link' target='_blank' data-tip={t('Source')}>
              <i className='k-icon k-icon-logo-github' />
            </a>
          }
        </bem.KDrawer__secondaryIcons>
      </bem.KDrawer>
      );
  }
}

reactMixin(Drawer.prototype, searches.common);
reactMixin(Drawer.prototype, mixins.droppable);
reactMixin(Drawer.prototype, mixins.contextRouter);

Drawer.contextTypes = {
  router: PropTypes.object
};

export default Drawer;
