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
  isLibrary,
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
              { isLibrary(this.context.router)
                ? <LibrarySidebar />
                : <FormSidebar />
              }
            </div>

            <ReactTooltip effect="float" place="bottom" />
          </bem.Drawer>
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }
});

var FormSidebar = React.createClass({
  mixins: [
    searches.common,
    mixins.droppable,
    Navigation,
    Reflux.connect(stores.session),
    Reflux.connect(stores.pageState)
  ],
  componentDidMount () {
    this.searchDefault();
  },
  getInitialState () {
    return assign({}, stores.pageState.state);
  },
  componentWillMount() {
    this.setStates();
  },
  setStates() {
    this.setState({
      headerFilters: 'forms',
      searchContext: searches.getSearchContext('forms', {
        filterParams: {
          assetType: 'asset_type:survey',
        },
        filterTags: 'asset_type:survey',
      })
    });
  },
  render () {
    return (
      <div>
        {this.state.headerBreadcrumb.map((item, n)=>{
          if (n < 1) {
            return (
              <div className="header-breadcrumb__item" key={`bc${n}`}>
                <i className="k-icon-projects" />
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
          </bem.CollectionNav__actions>
        </bem.CollectionNav>
        <SidebarFormsList/>
      </div>
    );
  },
  componentWillReceiveProps() {
    this.setStates();
  }

});

var LibrarySidebar = React.createClass({
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
    this.setState({
      headerFilters: 'library',
      searchContext: searches.getSearchContext('library', {
        filterParams: {
          assetType: 'asset_type:question OR asset_type:block',
        },
        filterTags: 'asset_type:question OR asset_type:block',
      })
    });
  },
  clickFilterByCollection (evt) {
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
    this.transitionTo('library');
  },
  clickShowPublicCollections (evt) {
    //TODO: show the collections in the main pane?
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
  render () {
    return (
      <div>
        {this.state.headerBreadcrumb.map((item, n)=>{
          if (n < 1) {
            return (
              <div className="header-breadcrumb__item" key={`bc${n}`}>
                <i className="k-icon-library" />
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
            <ul htmlFor="sidebar-menu" className="mdl-menu mdl-menu--bottom-right mdl-js-menu mdl-js-ripple-effect">
              <bem.CollectionNav__link key={'new-asset'} m={['new', 'new-block']} className="mdl-menu__item"
                  href={this.makeHref('library-new-form')}>
                <i />
                {t('add to library')}
              </bem.CollectionNav__link>
              <bem.CollectionNav__button key={'new-collection'} m={['new', 'new-collection']} className="mdl-menu__item"
                  onClick={this.createCollection}>
                <i />
                {t('new collection')}
              </bem.CollectionNav__button>
            </ul>
          </bem.CollectionNav__actions>
        </bem.CollectionNav>

        { this.state.sidebarCollections &&
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
                    <i className={iconClass} />
                    {collection.name}
                    { collection.access_type !== 'owned' ?
                        <bem.CollectionSidebar__itembyline>
                        {t('by ___').replace('___', collection.owner__username)}
                        </bem.CollectionSidebar__itembyline>
                      : null
                    }
                    <bem.CollectionSidebar__itemactions>
                      { collection.access_type === 'subscribed' ?
                          <bem.CollectionSidebar__itemlink href={'#'}
                            onClick={this.unsubscribeCollection}
                            data-collection-uid={collection.uid}>
                            {t('unsubscribe')}
                          </bem.CollectionSidebar__itemlink>
                        : [
                          <bem.CollectionSidebar__itemlink href={'#'}
                            onClick={this.deleteCollection}
                            data-collection-uid={collection.uid}>
                            {t('delete')}
                          </bem.CollectionSidebar__itemlink>,
                          <bem.CollectionSidebar__itemlink href={sharingLink}>
                            {t('sharing')}
                          </bem.CollectionSidebar__itemlink>,
                          <br />,
                          <bem.CollectionSidebar__itemlink href={'#'}
                            onClick={this.renameCollection(collection)
                          }>
                            {t('rename')}
                          </bem.CollectionSidebar__itemlink>,
                          collection.access_type === 'owned' ?
                            collection.discoverable_when_public ?
                              <bem.CollectionSidebar__itemlink href={'#'}
                                onClick={
                                  this.setCollectionDiscoverability(
                                    false, collection)
                              }>
                                {t('make private')}
                              </bem.CollectionSidebar__itemlink>
                            :
                              <bem.CollectionSidebar__itemlink href={'#'}
                                onClick={
                                  this.setCollectionDiscoverability(
                                    true, collection)
                              }>
                                {t('make public')}
                              </bem.CollectionSidebar__itemlink>
                          : null
                        ]
                      }
                    </bem.CollectionSidebar__itemactions>
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
      </div>
      );
  },
  componentWillReceiveProps() {
    this.setStates();
  }

});

export default Drawer;
