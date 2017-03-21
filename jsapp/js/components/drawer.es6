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
  newFormModal (evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: 'new-form'
    });
  },
  render () {
    return (
      <bem.FormSidebar__wrapper>
        <ui.PopoverMenu type='new-menu' 
            triggerLabel={t('new')}>
            <bem.PopoverMenu__link onClick={this.newFormModal}>
              <i className="k-icon-projects" />
              {t('Project')}
            </bem.PopoverMenu__link>
            <Dropzone onDropFiles={this.dropFiles} params={{destination: false}} fileInput>
              <bem.PopoverMenu__link>
                <i className="k-icon-upload" />
                {t('upload')}
              </bem.PopoverMenu__link>
            </Dropzone>
        </ui.PopoverMenu>
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
      publicCollectionsVisible: false,
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
    this.setState({
      publicCollectionsVisible: !this.state.publicCollectionsVisible,
    });
    //TODO: show the collections in the main pane?
  },
  createCollection () {
    customPromptAsync('collection name?').then((val)=>{
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
    customPromptAsync('collection name?', collectionName).then((val)=>{
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
  sharingModal (evt) {
    evt.preventDefault();
    var collectionUid = $(evt.currentTarget).data('collection-uid');
    stores.pageState.showModal({
      type: 'sharing', 
      assetid: collectionUid
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
        <ui.PopoverMenu type='new-menu' 
            triggerLabel={t('new')}>
            <bem.PopoverMenu__link href={this.makeHref('library-new-form')}>
              <i className="k-icon-question" />
              {t('Question')}
            </bem.PopoverMenu__link>
            <Dropzone onDropFiles={this.dropFiles} params={{destination: false}} fileInput>
              <bem.PopoverMenu__link>
                <i className="k-icon-upload" />
                {t('upload')}
              </bem.PopoverMenu__link>
            </Dropzone>
            <bem.PopoverMenu__link onClick={this.createCollection}>
              <i className="k-icon-folder" />
              {t('collection')}
          </bem.PopoverMenu__link>
        </ui.PopoverMenu>

        { this.state.sidebarCollections &&
          <bem.FormSidebar>
            <bem.FormSidebar__label
              key='allitems'
              m={{selected: !this.state.publicCollectionsVisible}} 
              onClick={this.clickFilterByCollection}>
                  <i className="k-icon-library" />
                  {t('My Library')}
              <bem.FormSidebar__labelCount>
                {this.state.sidebarCollections.length}
              </bem.FormSidebar__labelCount>

            </bem.FormSidebar__label>
            <bem.FormSidebar__grouping>
            {this.state.sidebarCollections.map((collection)=>{
              var editLink = this.makeHref('collection-page', {uid: collection.uid});
              var iconClass = 'k-icon-folder';
              if (collection.discoverable_when_public)
                iconClass = 'k-icon-folder-public';
              if (collection.access_type == 'shared')
                iconClass = 'k-icon-folder-shared';

              return (
                  <bem.FormSidebar__item
                    key={collection.uid}
                    m={{
                      collection: true,
                      selected:
                        this.state.filteredCollectionUid ===
                          collection.uid &&
                        !this.state.filteredByPublicCollection,
                    }}>
                    <bem.FormSidebar__itemlink
                      onClick={this.clickFilterByCollection}
                      data-collection-uid={collection.uid} 
                      data-collection-name={collection.name}>
                      <i className={iconClass} />
                      {collection.name}
                    </bem.FormSidebar__itemlink>
                    { !this.state.filteredByPublicCollection && this.state.filteredCollectionUid === collection.uid &&
                      <ui.PopoverMenu type='collectionSidebarPublic-menu' 
                          triggerLabel={<i className="k-icon-more" />}>
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
                              onClick={this.sharingModal}
                              data-collection-uid={collection.uid}
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

                      </ui.PopoverMenu>
                    }
                  </bem.FormSidebar__item>
                );
            })}
            </bem.FormSidebar__grouping>
            <bem.FormSidebar__label
              key='public'
              m={{selected: this.state.publicCollectionsVisible}} 
              onClick={this.clickShowPublicCollections}>
              <i className="k-icon-globe" />
              {t('Public Collections')}
              <bem.FormSidebar__labelCount>
                {this.state.sidebarPublicCollections.length}
              </bem.FormSidebar__labelCount>
            </bem.FormSidebar__label>
            <bem.FormSidebar__grouping m={[this.state.publicCollectionsVisible ? 'visible' : 'collapsed']}>
            {this.state.sidebarPublicCollections.map((collection)=>{
              var editLink = this.makeHref('collection-page', {uid: collection.uid});
              return (
                  <bem.FormSidebar__item
                    key={collection.uid}
                    m={{
                      collection: true,
                      selected:
                        this.state.filteredCollectionUid ===
                          collection.uid &&
                        this.state.filteredByPublicCollection,
                    }}
                  > 
                    <bem.FormSidebar__itemlink
                      onClick={this.clickFilterByCollection}
                      data-collection-uid={collection.uid}
                      data-public-collection={true}>
                        <i className="k-icon-folder-public" />
                        <bem.FormSidebar__iteminner>
                          {collection.name}
                          <bem.FormSidebar__itembyline>
                            {t('by ___').replace('___', collection.owner__username)}
                          </bem.FormSidebar__itembyline>
                        </bem.FormSidebar__iteminner>
                    </bem.FormSidebar__itemlink>
                    {this.state.filteredCollectionUid === collection.uid && this.state.filteredByPublicCollection && 
                      <ui.PopoverMenu type='collectionSidebar-menu' 
                          triggerLabel={<i className="k-icon-more" />}>
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
                        </ui.PopoverMenu>
                      }
                  </bem.FormSidebar__item>
                );
            })}
            </bem.FormSidebar__grouping>
          </bem.FormSidebar>
        }
      </bem.CollectionsWrapper>
      );
  },
  componentWillReceiveProps() {
    this.setStates();
  }

});

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
            </div>

            <div className='k-drawer__icons-bottom'>
              { stores.session.currentAccount &&
                <a href={stores.session.currentAccount.projects_url} 
                   className='k-drawer__link' 
                   target="_blank"
                   data-tip={t('Projects (legacy)')}>
                  <i className="k-icon k-icon-globe" />
                </a>
              }
              <a href='https://github.com/kobotoolbox/' className='k-drawer__link' target="_blank" data-tip={t('source')}>
                <i className="k-icon k-icon-github" />
              </a>
              { stores.session.currentAccount &&
                <a href={supportUrl()} className='k-drawer__link' target="_blank" data-tip={t('help')}>
                  <i className="k-icon k-icon-help" />
                </a>
              }
            </div>
          </bem.Drawer>
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }
});
export default Drawer;
