import React from 'react/addons';
import Reflux from 'reflux';
import {Link} from 'react-router';
import {Navigation} from 'react-router';
import Dropzone from '../libs/dropzone';
import Select from 'react-select';
import mdl from '../libs/rest_framework/material';
import alertify from 'alertifyjs';

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
  getAnonymousUserPermission,
  anonUsername,
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
        sidebarCollections: collections.results.filter((value) => {
          return value.access_type !== 'public';
        }),
        sidebarPublicCollections: collections.results.filter((value) => {
          return value.access_type === 'public' ||
            value.access_type === 'subscribed';
        })
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
    var target = $(evt.target);
    if (target.hasClass('collection-toggle')) {
      return false;
    }

    var data = $(evt.currentTarget).data();    
    var collectionUid = false;
    var publicCollection = false;
    if (data.collectionUid) {
      collectionUid = data.collectionUid;
    }
    if (data.publicCollection) {
      publicCollection = true;
    }
    this.quietUpdateStore({
      parentUid: collectionUid,
      allPublic: publicCollection
    });
    this.searchValue();
    this.setState({
      filteredCollectionUid: collectionUid,
      filteredByPublicCollection: publicCollection,
    });
  },
  clickShowPublicCollections (evt) {
    //TODO: show the collections in the main pane?
  },
  toggleCollectionSettings (evt) {
    var isBlur = evt.type === 'blur',
        $popoverMenu;
    if (isBlur) {
      $popoverMenu = $(this.refs['collection-popover'].getDOMNode());
      // if we setState and immediately hide popover then the
      // download links will not register as clicked
      $popoverMenu.fadeOut(250, () => {
        this.setState({
          selectedCollectionSettings: false,
        });
      });
    } else {
      this.setState({
        selectedCollectionSettings: true,
      });
    }
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
  renameCollection (collection) {
    return (evt) => {
      evt.preventDefault();
      customPromptAsync('collection name?', collection.name).then((val)=>{
        actions.resources.updateCollection(collection.uid, {name: val}).then(
          (data) => {
            this.queryCollections();
          }
        );
      });
    };
  },
  subscribeCollection (evt) {
    evt.preventDefault();
    var collectionUid = $(evt.currentTarget).data('collection-uid');
    dataInterface.subscribeCollection({
      uid: collectionUid,
    }).then(() => {
      this.queryCollections();
    });
  },
  unsubscribeCollection (evt) {
    evt.preventDefault();
    var collectionUid = $(evt.currentTarget).data('collection-uid');
    dataInterface.unsubscribeCollection({
      uid: collectionUid,
    }).then(() => {
      this.queryCollections();
    });
  },
  setCollectionDiscoverability (discoverable, collection) {
    return (evt) => {
      evt.preventDefault();
      var publicPerm = getAnonymousUserPermission(collection.permissions);
      var permDeferred = false;
      if (discoverable) {
        permDeferred = actions.permissions.assignPerm({
          role: 'view',
          username: anonUsername,
          uid: collection.uid,
          kind: collection.kind,
          objectUrl: collection.url
        });
      }
      else if (publicPerm) {
        permDeferred = actions.permissions.removePerm({
          permission_url: publicPerm.url,
          content_object_uid: collection.uid
        });
      }
      if (permDeferred) {
        var discovDeferred = permDeferred.then(() => {
          actions.permissions.setCollectionDiscoverability(
            collection.uid, discoverable
          );
        }).catch((jqxhr) => {
          // maybe publicPerm was already removed
          if (jqxhr.status !== 404) {
            alertify.error(t('unexpected error removing public permission'));
          }
        });
      } else {
        var discovDeferred = actions.permissions.setCollectionDiscoverability(
          collection.uid, discoverable
        );
      }
      discovDeferred.then(() => {
        window.setTimeout(this.queryCollections, 1);
      });
    };
  },
  toggleFixedDrawer() {
    stores.pageState.toggleFixedDrawer();
  },
  render () {
    return (
          <bem.Drawer className='k-drawer'>
            <nav className='k-drawer__icons'>
              <DrawerLink label={t('Projects')} linkto='forms' ki-icon='projects' class='projects'/>
              <DrawerLink label={t('Library')} linkto='library' ki-icon='library' class='library' />
            </nav>

            <div className="drawer__sidebar">
              <button className="mdl-button mdl-button--icon k-drawer__close" onClick={this.toggleFixedDrawer}>
                <i className="k-icon-close"></i>
              </button>

              {this.state.headerBreadcrumb.map((item, n)=>{
                if (n < 1) {
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
                        toplevel: true,
                        selected: !this.state.filteredCollectionUid,
                      }} onClick={this.clickFilterByCollection}>
                    <i className="fa fa-caret-down" />
                    <i className="k-icon-folder" />
                    {t('My Library')}
                  </bem.CollectionSidebar__item>
                  {this.state.sidebarCollections.map((collection)=>{
                    var editLink = this.makeHref('collection-page', {uid: collection.uid}),
                      sharingLink = this.makeHref('collection-sharing', {assetid: collection.uid});
                    var iconClass = 'k-icon-folder';
                    switch (collection.access_type) {
                      case 'public':
                      case 'subscribed':
                        iconClass = 'k-icon-globe';
                        break;
                      case 'shared':
                        iconClass = 'k-icon-folder-share';
                    }
                    return (
                        <bem.CollectionSidebar__item
                          key={collection.uid}
                          m={{
                            collection: true,
                            selected:
                              this.state.filteredCollectionUid ===
                                collection.uid &&
                              !this.state.filteredByPublicCollection,
                          }}
                          onClick={this.clickFilterByCollection}
                          data-collection-uid={collection.uid}
                        >
                          { this.state.filteredCollectionUid === collection.uid &&
                            <bem.CollectionSidebar__itemCog 
                                onFocus={this.toggleCollectionSettings}
                                onBlur={this.toggleCollectionSettings}>
                              <i className='collection-toggle k-icon-settings-small' />
                            </bem.CollectionSidebar__itemCog>
                          }
                          <i className={iconClass} />
                          {collection.name}
                          { collection.access_type !== 'owned' ?
                              <bem.CollectionSidebar__itembyline>
                              {t('by ___').replace('___', collection.owner__username)}
                              </bem.CollectionSidebar__itembyline>
                            : null
                          }

                          { (this.state.selectedCollectionSettings) &&
                            <bem.PopoverMenu ref='collection-popover'>
                              { collection.access_type === 'subscribed' &&
                                <bem.PopoverMenu__link
                                    m={'unsubscribe'}
                                    onClick={this.unsubscribeCollection}
                                    data-collection-uid={collection.uid}
                                    >
                                  {t('Unsubscribe')}
                                </bem.PopoverMenu__link>
                              }
                              { collection.access_type === 'owned' && collection.discoverable_when_public &&
                                <bem.PopoverMenu__link
                                    m={'make-private'}
                                    onClick={this.setCollectionDiscoverability(false, collection)}
                                    >
                                  {t('Make Private')}
                                </bem.PopoverMenu__link>
                              }
                              { collection.access_type === 'owned' && !collection.discoverable_when_public &&
                                <bem.PopoverMenu__link
                                    m={'make-public'}
                                    onClick={this.setCollectionDiscoverability(true, collection)}
                                    >
                                  {t('Make Public')}
                                </bem.PopoverMenu__link>
                              }

                              <bem.PopoverMenu__link
                                  m={'share'}
                                  href={sharingLink}
                                  >
                                <i className="k-icon-share" />
                                {t('Share')}
                              </bem.PopoverMenu__link>
                              <bem.PopoverMenu__link
                                  m={'delete'}
                                  onClick={this.deleteCollection}
                                  data-collection-uid={collection.uid}
                                  >
                                <i className="k-icon-trash" />
                                {t('Delete')}
                              </bem.PopoverMenu__link>

                            </bem.PopoverMenu>
                          }
                          
                        </bem.CollectionSidebar__item>
                      );
                  })}
                  <bem.CollectionSidebar__item
                    key='public'
                    m={{
                        toplevel: true,
                        selected: this.state.showPublicCollections,
                      }} onClick={this.clickShowPublicCollections}>
                    <i className="fa fa-caret-down" />
                    <i className="k-icon-folder" />
                    {t('Public Collections')}
                  </bem.CollectionSidebar__item>
                  {this.state.sidebarPublicCollections.map((collection)=>{
                    var editLink = this.makeHref('collection-page', {uid: collection.uid}),
                      sharingLink = this.makeHref('collection-sharing', {assetid: collection.uid});
                    return (
                        <bem.CollectionSidebar__item
                          key={collection.uid}
                          m={{
                            collection: true,
                            selected:
                              this.state.filteredCollectionUid ===
                                collection.uid &&
                              this.state.filteredByPublicCollection,
                          }}
                          onClick={this.clickFilterByCollection}
                          data-collection-uid={collection.uid}
                          data-public-collection={true}
                        >
                          <i className="k-icon-globe" />
                          {collection.name}
                          <bem.CollectionSidebar__itembyline>
                          {t('by ___').replace('___', collection.owner__username)}
                          </bem.CollectionSidebar__itembyline>
                          <bem.CollectionSidebar__itemactions>
                            { collection.access_type === 'subscribed' ?
                                <bem.CollectionSidebar__itemlink href={'#'}
                                  onClick={this.unsubscribeCollection}
                                  data-collection-uid={collection.uid}>
                                  {t('unsubscribe')}
                                </bem.CollectionSidebar__itemlink>
                              :
                                <bem.CollectionSidebar__itemlink href={'#'}
                                  onClick={this.subscribeCollection}
                                  data-collection-uid={collection.uid}>
                                  {t('subscribe')}
                                </bem.CollectionSidebar__itemlink>
                            }
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

            <div className='k-drawer__icons-bottom'>
              <a href='https://github.com/kobotoolbox/' className='k-drawer__link'>
                <i className="k-icon k-icon-github" />
                {t('source')}
              </a>
              <a href='http://support.kobotoolbox.org/' className='k-drawer__link'>
                <i className="k-icon k-icon-help" />
                {t('help')}
              </a>
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
