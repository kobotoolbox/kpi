import React from 'react/addons';
import Reflux from 'reflux';
import {Link} from 'react-router';
import {Navigation} from 'react-router';
import Dropzone from '../libs/dropzone';
import Select from 'react-select';

import {dataInterface} from '../dataInterface';
import actions from '../actions';
import stores from '../stores';
import bem from '../bem';
import searches from '../searches';
import mixins from '../mixins';
import {
  t,
  assign,
} from '../utils';

var leaveBetaUrl = stores.pageState.leaveBetaUrl;

var CollectionSidebar = bem.create('collection-sidebar', '<ul>'),
    CollectionSidebar__item = bem.create('collection-sidebar__item', '<li>'),
    CollectionSidebar__itemlink = bem.create('collection-sidebar__itemlink', '<a>');

class DrawerTitle extends React.Component {
  render () {
    var kls = 'sidebar-title';
    if (this.props.separator) {
      kls += ' separator';
    }
    return (
        <li className={kls}>
          <span>{this.props.label}</span>
        </li>
      );
  }
}
class DrawerLink extends React.Component {
  onClick (evt) {
    if (!this.props.href) {
      evt.preventDefault();
    }
    if (this.props.onClick) {
      this.props.onClick(evt);
    }
  }
  toggleDrawer () {
    stores.pageState.toggleDrawer();
  }

  render () {
    var icon_class = `ki ki-${this.props['ki-icon'] || 'globe'}`; 
    var icon = (<span className={icon_class}></span>);

    var link;
    var style = {};
    if (this.props.lowercase) {
      // to get navigation items looking the same,
      // a lowercase prop can be passed.
      // if the drawer items were all using a unique css class we could do this in css
      style = {'text-transform': 'lowercase'};
    }
    if (this.props.linkto) {
      link = (
            <Link to={this.props.linkto}
                className='k-drawer__link'
                activeClassName='active'
                title={this.props.label}
                onClick={this.toggleDrawer}>
              {icon} 
              <span className="label">{this.props.label}</span>
            </Link>
            );
    } else {
      link = (
          <a href={this.props.href || '#'}
              className='k-drawer__link'
              onClick={this.onClick.bind(this)} title={this.props.label}>{icon} <span className="label">{this.props.label}</span></a>
        );
    }
    return link;
  }
}

var Drawer = React.createClass({
  mixins: [
    searches.common,
    mixins.droppable,
    Navigation,
    Reflux.connect(stores.session),
    Reflux.connect(stores.pageState)
  ],
  queryCollections () {
    dataInterface.listCollections().then((collections)=>{
      this.setState({
        sidebarCollections: collections.results,
      });
    });
  },
  componentDidMount () {
    this.searchDefault();
    this.queryCollections();
  },
  getInitialState () {
    return assign({}, stores.pageState.state);
  },
  componentWillMount() {
    this.setStates();
  },
  setStates() {
    var breadcrumb = this.state.headerBreadcrumb;
    if (breadcrumb[0] && breadcrumb[0].to == 'library') {
      this.setState({headerFilters: 'library'});
    } else {
      this.setState({headerFilters: 'forms'});
    }
  },
  clickFilterByCollection (evt) {
    var data = $(evt.currentTarget).data();
    if (data.collectionUid) {
      this.filterByCollection(data.collectionUid);
    } else {
      this.filterByCollection(false);
    }
  },
  filterByCollection (collectionUid) {
    if (collectionUid) {
      this.quietUpdateStore({
        parentUid: collectionUid,
      });
    } else {
      this.quietUpdateStore({
        parentUid: false,
      });
    }
    this.searchValue();
    this.setState({
      filteredCollectionUid: collectionUid,
    });
  },
  createCollection () {
    customPromptAsync('collection name?').then((val)=>{
      dataInterface.createCollection({
        name: val,
      }).then((data)=>{
        this.queryCollections();
      });
    });
  },
  deleteCollection (evt) {
    evt.preventDefault();
    var collectionUid = $(evt.currentTarget).data('collection-uid');
    customConfirmAsync('are you sure you want to delete this collection? this action is not reversible').then(()=>{
      var qc = () => this.queryCollections();
      dataInterface.deleteCollection({uid: collectionUid}).then(qc).catch(qc);
    });
  }, 
  render () {
    return (
          <bem.Drawer className='mdl-layout__drawer mdl-shadow--2dp'>
            <nav className='k-drawer__icons'> 
              <DrawerLink label={t('forms')} linkto='forms' ki-icon='forms' />
              <DrawerLink label={t('library')} linkto='library' ki-icon='library' />
              { stores.session.currentAccount ?
                  <DrawerLink label={t('projects')} active='true' href={stores.session.currentAccount.projects_url} ki-icon='globe' />
              : null }
              <div className="mdl-layout-spacer"></div>

              <div className='k-drawer__icons-bottom'>
                <DrawerLink label={t('source')} href='https://github.com/kobotoolbox/' ki-icon='github' />
                <DrawerLink label={t('help')} href='http://support.kobotoolbox.org/' ki-icon='help' />
              </div>
            </nav>

            <div className="drawer__sidebar">
              {this.state.headerBreadcrumb.map((item, n)=>{
                return (
                    <div className="header-breadcrumb__item" key={`bc${n}`}>
                      {
                        ('to' in item) ?
                        <Link to={item.to} params={item.params}>{item.label}</Link>
                        :
                        <a href={item.href}>{item.label}</a>
                      }
                    </div>
                  );
              })}
              {/* library sidebar menu */}
              <bem.CollectionNav>
                <bem.CollectionNav__actions className="k-form-list-actions">
                  <button id="sidebar-menu"
                          className="mdl-button mdl-js-button mdl-button--raised mdl-button--colored">
                    {t('new')}
                  </button>

                    {this.state.headerFilters == 'library' ?
                      <ul htmlFor="sidebar-menu" className="mdl-menu mdl-menu--bottom-right mdl-js-menu mdl-js-ripple-effect">
                        <bem.CollectionNav__link key={'new-asset'} m={['new', 'new-block']} className="mdl-menu__item"
                            href={this.makeHref('add-to-library')}>
                          <i />
                          {t('add to library')}
                        </bem.CollectionNav__link>
                        <bem.CollectionNav__button key={'new-collection'} m={['new', 'new-collection']} className="mdl-menu__item"
                            onClick={this.createCollection}>
                          <i />
                          {t('new collection')}
                        </bem.CollectionNav__button>
                      </ul>
                    : null }
                    {this.state.headerFilters == 'forms' ?
                      <ul htmlFor="sidebar-menu" className="mdl-menu mdl-menu--bottom-right mdl-js-menu mdl-js-ripple-effect">
                        <bem.CollectionNav__link className="mdl-menu__item" m={['new', 'new-block']}
                            href={this.makeHref('new-form')}>
                          <i />
                          {t('new form')}
                        </bem.CollectionNav__link>
                        <Dropzone onDropFiles={this.dropFiles} params={{destination: false}} fileInput>
                          <bem.CollectionNav__button m={['upload', 'upload-block']} className="mdl-menu__item">
                            <i className='fa fa-icon fa-cloud fa-fw' />
                            {t('upload')}
                          </bem.CollectionNav__button>
                        </Dropzone>
                      </ul>
                    : null }
                </bem.CollectionNav__actions>
              </bem.CollectionNav>
              {/* end library sidebar menu */}
              { this.state.sidebarCollections && this.state.headerFilters == 'library' ?
                <CollectionSidebar>
                  <CollectionSidebar__item
                    key='allitems'
                    m={{
                        allitems: true,
                        selected: !this.state.filteredCollectionUid,
                      }} onClick={this.clickFilterByCollection}>
                    <i />
                    {t('all items (no filter)')}
                  </CollectionSidebar__item>
                  {/*
                  <CollectionSidebar__item
                    key='info'
                    m='info'
                  >
                    {t('filter by collection')}
                  </CollectionSidebar__item>
                  */}
                  {this.state.sidebarCollections.map((collection)=>{  
                    var editLink = this.makeHref('collection-page', {uid: collection.uid}),
                      sharingLink = this.makeHref('collection-sharing', {assetid: collection.uid});
                    return (
                        <CollectionSidebar__item
                          key={collection.uid}
                          m={{
                            collection: true,
                            selected: this.state.filteredCollectionUid === collection.uid,
                          }}
                          onClick={this.clickFilterByCollection}
                          data-collection-uid={collection.uid}
                        >
                          <i />
                          {collection.name}
                          <CollectionSidebar__itemlink href={'#'}
                            onClick={this.deleteCollection}
                            data-collection-uid={collection.uid}>
                            {t('delete')}
                          </CollectionSidebar__itemlink>
                          <CollectionSidebar__itemlink href={sharingLink}>
                            {t('sharing')}
                          </CollectionSidebar__itemlink>
                          <CollectionSidebar__itemlink href={editLink}>
                            {t('edit')}
                          </CollectionSidebar__itemlink>
                        </CollectionSidebar__item>
                      );
                  })}
                </CollectionSidebar>
                :
                {/*<CollectionSidebar>
                  <CollectionSidebar__item m={'loading'}>
                    {t('loading')}
                    <i />
                  </CollectionSidebar__item>
                </CollectionSidebar>*/}
              }
            </div>
          </bem.Drawer>
      );
  },
  componentWillReceiveProps() {
    this.setStates();
  }

});

export default Drawer;
