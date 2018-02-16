import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import { Link } from 'react-router';
import Dropzone from 'react-dropzone';
import Select from 'react-select';
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
  assign,
  validFileTypes,
  getAnonymousUserPermission,
  anonUsername
} from '../utils';

import SidebarFormsList from '../lists/sidebarForms';

var leaveBetaUrl = stores.pageState.leaveBetaUrl;

class LibrarySidebar extends Reflux.Component {
  constructor(props){
    super(props);
    this.state = assign({}, stores.pageState.state);
    this.stores = [
      stores.session,
      stores.pageState
    ];
    autoBind(this);
  }
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
  }
  componentDidMount () {
    this.searchDefault();
    this.queryCollections();
  }
  componentWillMount() {
    this.setStates();
  }
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
  }
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
  }
  clickShowPublicCollections (evt) {
    this.setState({
      publicCollectionsVisible: !this.state.publicCollectionsVisible,
    });
    //TODO: show the collections in the main pane?
  }
  createCollection () {
    let dialog = alertify.dialog('prompt');
    let opts = {
      title: t('Crear colección'),
      message: t('Por favor ingrese el nombre de su nueva Colección. Las colecciones pueden ayudarlo a organizar mejor su biblioteca, y es posible compartir cada colección con diferentes personas.'),
      labels: {ok: t('Crear colección'), cancel: t('Cancelar')},
      onok: (evt, val) => {
        dataInterface.createCollection({
          name: val,
        }).then((data)=>{
          this.queryCollections();
          this.searchValue.refresh();
          dialog.destroy();
        });
        // keep the dialog open
        return false;
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();

  }
  deleteCollection (evt) {
    evt.preventDefault();
    var collectionUid = $(evt.currentTarget).data('collection-uid');
    let dialog = alertify.dialog('confirm');
    let opts = {
      title: t('Eliminar colección'),
      message: t('¿Seguro que quieres eliminar esta colección? Esta acción no es reversible'),
      labels: {ok: t('Eliminar'), cancel: t('Cancelar')},
      onok: (evt, val) => {
        dataInterface.deleteCollection({uid: collectionUid}).then((data)=> {
          this.queryCollections();
          dialog.destroy();
        }).fail((jqxhr)=> {
          alertify.error(t('Error al eliminar la colección.'));
        });
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();

  }
  renameCollection (evt) {
    var collectionUid = $(evt.currentTarget).data('collection-uid');
    var collectionName = $(evt.currentTarget).data('collection-name');

    let dialog = alertify.dialog('prompt');
    let opts = {
      title: t('Cambiar el nombre de la colección'),
      message: t('Por favor ingrese el nombre de su nueva colección.'),
      value: collectionName,
      labels: {ok: t('De acuerdo'), cancel: t('Cancelar')},
      onok: (evt, val) => {
        actions.resources.updateCollection.triggerAsync(collectionUid, {name: val}).then(
          (data) => {
            this.queryCollections();
            dialog.destroy();
          }
        );
        // keep the dialog open
        return false;
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();

  }
  subscribeCollection (evt) {
    evt.preventDefault();
    var collectionUid = $(evt.currentTarget).data('collection-uid');
    dataInterface.subscribeCollection({
      uid: collectionUid,
    }).then(() => {
      this.queryCollections();
    });
  }
  unsubscribeCollection (evt) {
    evt.preventDefault();
    var collectionUid = $(evt.currentTarget).data('collection-uid');
    dataInterface.unsubscribeCollection({
      uid: collectionUid,
    }).then(() => {
      this.queryCollections();
    });
  }
  sharingModal (evt) {
    evt.preventDefault();
    var collectionUid = $(evt.currentTarget).data('collection-uid');
    stores.pageState.showModal({
      type: 'sharing', 
      assetid: collectionUid
    });
  }
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
          actions.permissions.setCollectionDiscoverability.triggerAsync(
            collection.uid, discoverable
          );
        }).catch((jqxhr) => {
          // maybe publicPerm was already removed
          if (jqxhr.status !== 404) {
            alertify.error(t('unexpected error removing public permission'));
          }
        });
      } else {
        var discovDeferred = actions.permissions.setCollectionDiscoverability.triggerAsync(
          collection.uid, discoverable
        );
      }
      discovDeferred.then(() => {
        window.setTimeout(this.queryCollections, 1);
      });
    };
  }
  render () {
    return (
      <bem.CollectionsWrapper>
        <ui.PopoverMenu type='new-menu' 
            triggerLabel={t('nuevo')}>
            <Link to={`/library/new`} className='popover-menu__link'>
              <i className="k-icon-question" />
              {t('Pregunta')}
            </Link>
            <Dropzone onDrop={this.dropFiles} 
                          multiple={false} 
                          className='dropzone' 
                          accept={validFileTypes()}>
              <bem.PopoverMenu__link>
                <i className="k-icon-upload" />
                {t('subir')}
              </bem.PopoverMenu__link>
            </Dropzone>
            <bem.PopoverMenu__link onClick={this.createCollection}>
              <i className="k-icon-folder" />
              {t('colección')}
          </bem.PopoverMenu__link>
        </ui.PopoverMenu>

        { this.state.sidebarCollections &&
          <bem.FormSidebar>
            <bem.FormSidebar__label
              key='allitems'
              m={{selected: !this.state.publicCollectionsVisible}} 
              onClick={this.clickFilterByCollection}>
                  <i className="k-icon-library" />
                  {t('Mi biblioteca')}
              <bem.FormSidebar__labelCount>
                {this.state.sidebarCollections.length}
              </bem.FormSidebar__labelCount>

            </bem.FormSidebar__label>
            <bem.FormSidebar__grouping>
              {this.state.sidebarCollections.map((collection)=>{
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
                              {t('Hazlo privado')}
                            </bem.PopoverMenu__link>
                          }
                          { collection.access_type === 'owned' && !collection.discoverable_when_public &&
                            <bem.PopoverMenu__link
                                m={'make-public'}
                                onClick={this.setCollectionDiscoverability(true, collection)}
                                >
                              <i className="k-icon-globe" />
                              {t('Hazlo público')}
                            </bem.PopoverMenu__link>
                          }
                          { collection.access_type !== 'subscribed' &&
                            <bem.PopoverMenu__link
                                m={'share'}
                                onClick={this.sharingModal}
                                data-collection-uid={collection.uid}
                                >
                              <i className="k-icon-share" />
                              {t('Compartir')}
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
                              {t('Renombrar')}
                            </bem.PopoverMenu__link>
                          }
                          { collection.access_type !== 'subscribed' &&
                            <bem.PopoverMenu__link
                                m={'delete'}
                                onClick={this.deleteCollection}
                                data-collection-uid={collection.uid}
                                >
                              <i className="k-icon-trash" />
                              {t('Eliminar')}
                            </bem.PopoverMenu__link>
                          }
                          { collection.access_type === 'subscribed' &&

                            <bem.PopoverMenu__link
                                m={'unsubscribe'}
                                onClick={this.unsubscribeCollection}
                                data-collection-uid={collection.uid}
                                >
                              <i className="k-icon-trash" />
                              {t('Darse de baja')}
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
              {t('Colecciones públicas')}
              <bem.FormSidebar__labelCount>
                {this.state.sidebarPublicCollections.length}
              </bem.FormSidebar__labelCount>
            </bem.FormSidebar__label>
            <bem.FormSidebar__grouping m={[this.state.publicCollectionsVisible ? 'visible' : 'collapsed']}>
              {this.state.sidebarPublicCollections.map((collection)=>{
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
                              {t('por ___').replace('___', collection.owner__username)}
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
                                  {t('darse de baja')}
                                </bem.PopoverMenu__link>
                              :
                                <bem.PopoverMenu__link href={'#'}
                                  onClick={this.subscribeCollection}
                                  data-collection-uid={collection.uid}>
                                  <i className="k-icon-next" />
                                  {t('suscribir')}
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
  }
  componentWillReceiveProps() {
    this.setStates();
  }
};

reactMixin(LibrarySidebar.prototype, searches.common);
reactMixin(LibrarySidebar.prototype, mixins.droppable);

LibrarySidebar.contextTypes = {
  router: PropTypes.object
};

export default LibrarySidebar;
