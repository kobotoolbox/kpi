import React from 'react/addons';
import Reflux from 'reflux';
import {Link} from 'react-router';
import {Navigation} from 'react-router';
import Dropzone from '../libs/dropzone';
import Select from 'react-select';
import mdl from '../libs/rest_framework/material';

import {dataInterface} from '../dataInterface';
import actions from '../actions';
import stores from '../stores';
import bem from '../bem';
import searches from '../searches';
import mixins from '../mixins';
import ReactTooltip from 'react-tooltip';

import {
  t,
  customPromptAsync,
  customConfirmAsync,
  assign,
} from '../utils';

import SidebarFormsList from '../lists/sidebarForms';

var leaveBetaUrl = stores.pageState.leaveBetaUrl;

class DrawerLink extends React.Component {
  onClick (evt) {
    if (!this.props.href) {
      evt.preventDefault();
    }
    if (this.props.onClick) {
      this.props.onClick(evt);
    }
  }
  render () {
    var icon_class = (this.props['ki-icon'] == undefined ? `fa fa-globe` : `k-icon-${this.props['ki-icon']}`);
    var icon = (<i className={icon_class}></i>);

    var link;
    var style = {};
    // if (this.props.lowercase) {
    //   // to get navigation items looking the same,
    //   // a lowercase prop can be passed.
    //   // if the drawer items were all using a unique css class we could do this in css
    //   style = {'text-transform': 'lowercase'};
    // }
    if (this.props.linkto) {
      link = (
        <Link to={this.props.linkto}
            className='k-drawer__link'
            activeClassName='active'
            data-tip={this.props.label}>
          {icon}
        </Link>
      );
    } else {
      link = (
        <a href={this.props.href || '#'}
            className='k-drawer__link'
            onClick={this.onClick.bind(this)} 
            data-tip={this.props.label}>
            {icon}
        </a>
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
      this.setState({
        headerFilters: 'library',
        searchContext: searches.getSearchContext('library', {
          filterParams: {
            assetType: 'asset_type:question OR asset_type:block',
          },
          filterTags: 'asset_type:question OR asset_type:block',
        })
      });
    } else {
      this.setState({
        headerFilters: 'forms',
        searchContext: searches.getSearchContext('forms', {
          filterParams: {
            assetType: 'asset_type:survey',
          },
          filterTags: 'asset_type:survey',
        })
      });
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
  toggleFixedDrawer() {
    stores.pageState.toggleFixedDrawer();
  },
  render () {
    return (
          <bem.Drawer className='k-drawer mdl-shadow--2dp'>
            <nav className='k-drawer__icons'> 
              <DrawerLink label={t('Projects')} linkto='forms' ki-icon='projects' />
              <DrawerLink label={t('Library')} linkto='library' ki-icon='library' />
              { stores.session.currentAccount ?
                  <DrawerLink label={t('Projects')} active='true' href={stores.session.currentAccount.projects_url} className="is-edge" ki-icon='globe' />
              : null }
              <div className="mdl-layout-spacer"></div>

              <div className='k-drawer__icons-bottom'>
                <DrawerLink label={t('source')} href='https://github.com/kobotoolbox/' ki-icon='github' />
                <DrawerLink label={t('help')} href='http://support.kobotoolbox.org/' ki-icon='help' />
              </div>
            </nav>

            <div className="drawer__sidebar">
              <button className="mdl-button mdl-button--icon k-drawer__close" onClick={this.toggleFixedDrawer}>
                <i className="fa fa-close"></i>
              </button>

              {this.state.headerBreadcrumb.map((item, n)=>{
                if (n < 1) {
                  return (
                    <div className="header-breadcrumb__item" key={`bc${n}`}>
                      {item.to == 'library' ?
                        <i className="k-icon-library" />
                      :
                        <i className="k-icon-projects" />
                      }
                      {
                        ('to' in item) ?
                        <Link to={item.to} params={item.params}>{item.label}</Link>
                        :
                        <a href={item.href}>{item.label}</a>
                      }
                    </div>
                  );
                } else {
                  return '';
                }
              })}

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

              { this.state.sidebarCollections && this.state.headerFilters == 'library' &&
                <bem.CollectionSidebar>
                  <bem.CollectionSidebar__item
                    key='allitems'
                    m={{
                        allitems: true,
                        selected: !this.state.filteredCollectionUid,
                      }} onClick={this.clickFilterByCollection}>
                    <i className="fa fa-caret-down" />
                    <i className="k-icon-folder" />
                    {t('My Library')}
                  </bem.CollectionSidebar__item>
                  {this.state.sidebarCollections.map((collection)=>{  
                    var editLink = this.makeHref('collection-page', {uid: collection.uid}),
                      sharingLink = this.makeHref('collection-sharing', {assetid: collection.uid});
                    return (
                        <bem.CollectionSidebar__item
                          key={collection.uid}
                          m={{
                            collection: true,
                            selected: this.state.filteredCollectionUid === collection.uid,
                          }}
                          onClick={this.clickFilterByCollection}
                          data-collection-uid={collection.uid}
                        >
                          <i className="k-icon-folder" />
                          {collection.name}
                          <bem.CollectionSidebar__itemactions>
                            <bem.CollectionSidebar__itemlink href={'#'}
                              onClick={this.deleteCollection}
                              data-collection-uid={collection.uid}>
                              {t('delete')}
                            </bem.CollectionSidebar__itemlink>
                            <bem.CollectionSidebar__itemlink href={sharingLink}>
                              {t('sharing')}
                            </bem.CollectionSidebar__itemlink>
                            <bem.CollectionSidebar__itemlink href={editLink}>
                              {t('edit')}
                            </bem.CollectionSidebar__itemlink>
                          </bem.CollectionSidebar__itemactions>
                        </bem.CollectionSidebar__item>
                      );
                  })}
                </bem.CollectionSidebar>
              }
              { this.state.headerFilters == 'forms' &&
                <SidebarFormsList/>
              }
            </div>

            <ReactTooltip effect="float" place="bottom" />
          </bem.Drawer>
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  },
  componentWillReceiveProps() {
    this.setStates();
  }

});

export default Drawer;
