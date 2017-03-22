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
import ui from '../ui';
import mixins from '../mixins';

import {
  t,
  customPromptAsync,
  customConfirmAsync,
  assign,
  getAnonymousUserPermission,
  anonUsername,
  isLibrary,
  supportUrl,
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
              { isLibrary(this.context.router)
                ? <LibrarySidebar />
                : <FormSidebar />
              }

              <div className='k-drawer__icons-bottom'>
                { stores.session.currentAccount ?
                  <a href={stores.session.currentAccount.projects_url} className='k-drawer__link' target="_blank">
                    <i className="k-icon k-icon-globe" />
                    {t('Projects (legacy)')}
                  </a>
                : null }
                <a href='https://github.com/kobotoolbox/' className='k-drawer__link' target="_blank">
                  <i className="k-icon k-icon-github" />
                  {t('source')}
                </a>
                { stores.session.currentAccount ?
                  <a href={supportUrl()} className='k-drawer__link' target="_blank">
                    <i className="k-icon k-icon-help" />
                    {t('help')}
                  </a>
                : null}
              </div>
            </div>
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
      <bem.FormSidebar__wrapper>
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
      </bem.FormSidebar__wrapper>
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
    var target = $(evt.target);
    if (target.hasClass('collection-toggle')) {
      return false;
    }
    var data = $(evt.currentTarget).data();
    var collectionUid = false;
    var collectionName = false;
    var publicCollection = false;
    if (data.collectionUid) {
      collectionUid = data.collectionUid;
    }
    if (data.collectionName) {
      collectionName = data.collectionName;
    }
    if (data.publicCollection) {
      publicCollection = true;
    }
    this.quietUpdateStore({
      parentUid: collectionUid,
      parentName: collectionName,
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
    customPromptAsync(t('Please enter the name of your new Collection. Collections can help you better organize your library, and it is possible to share each collection with different people.')).then((val)=>{
      dataInterface.createCollection({
        name: val,
      }).then((data)=>{
        this.queryCollections();
        this.searchValue.refresh();
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
  renameCollection (evt) {
    var collectionUid = $(evt.currentTarget).data('collection-uid');
    var collectionName = $(evt.currentTarget).data('collection-name');

    evt.preventDefault();
    customPromptAsync(t('Please enter the name of your new Collection.'), collectionName).then((val)=>{
      actions.resources.updateCollection(collectionUid, {name: val}).then(
        (data) => {
          this.queryCollections();
        }
      );
    });
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
      <bem.CollectionsWrapper>
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
            <ul htmlFor="sidebar-menu" className="mdl-menu mdl-menu--bottom-right mdl-js-menu mdl-js-ripple-effect">
              <bem.CollectionNav__link key={'new-asset'} m={['new', 'new-block']} className="mdl-menu__item"
                  href={this.makeHref('library-new-form')}>
                <i />
                {t('add to library')}
              </bem.CollectionNav__link>
              <Dropzone onDropFiles={this.dropFiles} params={{destination: false}} fileInput>
                <bem.CollectionNav__button m={['upload', 'upload-block']} className="mdl-menu__item">
                  <i className='fa fa-icon fa-cloud fa-fw' />
                  {t('upload')}
                </bem.CollectionNav__button>
              </Dropzone>
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
                  selected: !this.state.showPublicCollections,
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
                  iconClass = 'k-icon-pubfolder';
                  break;
                case 'shared':
                  iconClass = 'k-icon-shared-folder';
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
                    data-collection-name={collection.name}
                  >
                    { !this.state.filteredByPublicCollection && this.state.filteredCollectionUid === collection.uid &&

                      <ui.MDLPopoverMenu id={"cog-" + collection.uid}
                                        button_type='cog-icon' 
                                        classname='collection-cog'
                                        menuClasses='mdl-menu mdl-menu--bottom-left mdl-js-menu'>
                        { collection.access_type === 'owned' && collection.discoverable_when_public &&
                          <bem.PopoverMenu__link
                              m={'make-private'}
                              onClick={this.setCollectionDiscoverability(false, collection)}
                              >
                            <i className="k-icon-globe" />
                            {t('Make Private')}
                          </bem.PopoverMenu__link>
                        }
                        { collection.access_type === 'owned' && !collection.discoverable_when_public &&
                          <bem.PopoverMenu__link
                              m={'make-public'}
                              onClick={this.setCollectionDiscoverability(true, collection)}
                              >
                            <i className="k-icon-globe" />
                            {t('Make Public')}
                          </bem.PopoverMenu__link>
                        }
                        { collection.access_type !== 'subscribed' &&
                          <bem.PopoverMenu__link
                              m={'share'}
                              href={sharingLink}
                              >
                            <i className="k-icon-share" />
                            {t('Share')}
                          </bem.PopoverMenu__link>
                        }

                        { collection.access_type !== 'subscribed' &&
                          <bem.PopoverMenu__link
                              m={'rename'}
                              onClick={this.renameCollection}
                              data-collection-uid={collection.uid}
                              data-collection-name={collection.name}
                              >
                            <i className="k-icon-edit" />
                            {t('Rename')}
                          </bem.PopoverMenu__link>
                        }
                        { collection.access_type !== 'subscribed' &&
                          <bem.PopoverMenu__link
                              m={'delete'}
                              onClick={this.deleteCollection}
                              data-collection-uid={collection.uid}
                              >
                            <i className="k-icon-trash" />
                            {t('Delete')}
                          </bem.PopoverMenu__link>
                        }
                        { collection.access_type === 'subscribed' &&

                          <bem.PopoverMenu__link
                              m={'unsubscribe'}
                              onClick={this.unsubscribeCollection}
                              data-collection-uid={collection.uid}
                              >
                            <i className="k-icon-trash" />
                            {t('Unsubscribe')}
                          </bem.PopoverMenu__link>
                        }

                      </ui.MDLPopoverMenu>
                    }
                    <i className={iconClass} />
                    {collection.name}
                    { collection.access_type !== 'owned' ?
                        <bem.CollectionSidebar__itembyline>
                        {t('by ___').replace('___', collection.owner__username)}
                        </bem.CollectionSidebar__itembyline>
                      : null
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
              <i className="k-icon-globe" />
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
                    {this.state.filteredCollectionUid === collection.uid && this.state.filteredByPublicCollection && 
                      <ui.MDLPopoverMenu id={"pub-cog-" + collection.uid}
                                        button_type='cog-icon' 
                                        classname='collection-cog'
                                        menuClasses='mdl-menu mdl-menu--bottom-left mdl-js-menu'>
                        { collection.access_type === 'subscribed' ?
                            <bem.PopoverMenu__link href={'#'}
                              onClick={this.unsubscribeCollection}
                              data-collection-uid={collection.uid}>
                              <i className="k-icon-next" />
                              {t('unsubscribe')}
                            </bem.PopoverMenu__link>
                          :
                            <bem.PopoverMenu__link href={'#'}
                              onClick={this.subscribeCollection}
                              data-collection-uid={collection.uid}>
                              <i className="k-icon-next" />
                              {t('subscribe')}
                            </bem.PopoverMenu__link>
                        }
                      </ui.MDLPopoverMenu>
                    }
                    <i className="k-icon-pubfolder" />
                    {collection.name}
                    <bem.CollectionSidebar__itembyline>
                    {t('by ___').replace('___', collection.owner__username)}
                    </bem.CollectionSidebar__itembyline>
                  </bem.CollectionSidebar__item>
                );
            })}
          </bem.CollectionSidebar>
        }
      </bem.CollectionsWrapper>
      );
  },
  componentWillReceiveProps() {
    this.setStates();
  }

});

export default Drawer;
