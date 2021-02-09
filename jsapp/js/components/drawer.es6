import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import { Link } from 'react-router';
import {stores} from '../stores';
import {bem} from '../bem';
import {searches} from '../searches';
import mixins from '../mixins';
import LibrarySidebar from 'js/components/library/librarySidebar';
import {
  IntercomHelpBubble,
  SupportHelpBubble
} from '../components/helpBubbles';
import {
  COMMON_QUERIES,
  MODAL_TYPES,
  ROUTES,
} from '../constants';
import {assign} from 'utils';
import SidebarFormsList from '../lists/sidebarForms';

class FormSidebar extends Reflux.Component {
  constructor(props){
    super(props);
    this.state = assign({
      currentAssetId: false,
      files: []
    }, stores.pageState.state);
    this.stores = [
      stores.session,
      stores.pageState
    ];
    autoBind(this);
  }
  componentWillMount() {
    this.setStates();
  }
  setStates() {
    this.setState({
      headerFilters: 'forms',
      searchContext: searches.getSearchContext('forms', {
        filterParams: {
          assetType: COMMON_QUERIES.s,
        },
        filterTags: COMMON_QUERIES.s,
      })
    });
  }
  newFormModal (evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: MODAL_TYPES.NEW_FORM
    });
  }
  render () {
    return (
      <React.Fragment>
        <bem.KoboButton onClick={this.newFormModal} m={['blue', 'fullwidth']}>
          {t('new')}
        </bem.KoboButton>
        <SidebarFormsList/>
      </React.Fragment>
    );
  }
  componentWillReceiveProps() {
    this.setStates();
  }

};

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
    var icon_class = (this.props['ki-icon'] == undefined ? 'fa fa-globe' : `k-icon-${this.props['ki-icon']}`);
    var icon = (<i className={icon_class}/>);
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
      stores.serverEnvironment,
    ];
  }
  render () {
    return (
      <bem.KDrawer>
        <bem.KDrawer__primaryIcons>
          <DrawerLink label={t('Projects')} linkto={ROUTES.FORMS} ki-icon='projects' />
          <DrawerLink label={t('Library')} linkto={ROUTES.LIBRARY} ki-icon='library' />
        </bem.KDrawer__primaryIcons>

        <bem.KDrawer__sidebar>
          { this.isLibrary()
            ? <LibrarySidebar />
            : <FormSidebar />
          }
        </bem.KDrawer__sidebar>

        <bem.KDrawer__secondaryIcons>
          { stores.session.currentAccount &&
            <IntercomHelpBubble/>
          }
          { stores.session.currentAccount &&
            <SupportHelpBubble/>
          }
          { stores.session.currentAccount &&
            <a href={stores.session.currentAccount.projects_url}
              className='k-drawer__link'
              target='_blank'
              data-tip={t('Projects (legacy)')}
            >
              <i className='k-icon k-icon-globe' />
            </a>
          }
          { stores.serverEnvironment &&
            stores.serverEnvironment.state.source_code_url &&
            <a href={stores.serverEnvironment.state.source_code_url}
              className='k-drawer__link' target='_blank' data-tip={t('Source')}>
              <i className='k-icon k-icon-github' />
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
