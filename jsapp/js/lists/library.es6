import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';
import Dropzone from '../libs/dropzone';

import searches from '../searches';
import mixins from '../mixins';
import stores from '../stores';
import bem from '../bem';
import ui from '../ui';
import {dataInterface} from '../dataInterface';
import SearchCollectionList from '../components/searchcollectionlist';
import {
  ListSearch,
  ListTagFilter,
  ListSearchSummary,
} from '../components/list';
import {
  t,
  customPromptAsync,
  customConfirmAsync,
} from '../utils';

var CollectionSidebar = bem.create('collection-sidebar', '<ul>'),
    CollectionSidebar__item = bem.create('collection-sidebar__item', '<li>'),
    CollectionSidebar__itemlink = bem.create('collection-sidebar__itemlink', '<a>');

var LibrarySearchableList = React.createClass({
  mixins: [
    searches.common,
    mixins.droppable,
    Navigation,
    Reflux.ListenerMixin,
  ],
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {

      var headerBreadcrumb = [
        {'label': t('Library'), 'href': '', }
      ];
      stores.pageState.setHeaderBreadcrumb(headerBreadcrumb);

      stores.pageState.setAssetNavPresent(false);
      callback();
    }
  },
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
  /*
  dropAction ({file, event}) {
    actions.resources.createAsset({
      base64Encoded: event.target.result,
      name: file.name,
      lastModified: file.lastModified,
      contentType: file.type
    });
  },
  */
  getInitialState () {
    return {
      searchContext: searches.getSearchContext('library', {
        filterParams: {
          assetType: 'asset_type:question OR asset_type:block',
        },
        filterTags: 'asset_type:question OR asset_type:block',
      })
    };
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
      <ui.Panel>
        <bem.CollectionNav>
          <bem.CollectionNav__search>
            <ListSearch
                placeholder={t('search library')}
                searchContext={this.state.searchContext}
              />
            <ListTagFilter
                searchContext={this.state.searchContext}
              />
          </bem.CollectionNav__search>

          <bem.CollectionNav__actions className="k-form-list-actions">
            <button id="demo-menu-top-right"
                    className="mdl-button mdl-js-button mdl-button--fab mdl-button--colored">
              <i className="material-icons">add</i>
            </button>

            <ul className="mdl-menu mdl-menu--top-right mdl-js-menu mdl-js-ripple-effect"
                htmlFor="demo-menu-top-right">
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
              <Dropzone onDropFiles={this.dropFiles} className="mdl-menu__item"
                  params={{destination: false}} fileInput>
                <bem.CollectionNav__button m={['upload', 'upload-block']} className="mdl-menu__item">
                  <i className='fa fa-icon fa-cloud fa-fw' />
                  &nbsp;&nbsp;
                  {t('upload')}
                </bem.CollectionNav__button>
              </Dropzone>
            </ul>
          </bem.CollectionNav__actions>
        </bem.CollectionNav>
        {
          this.state.sidebarCollections ?
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
          <CollectionSidebar>
            <CollectionSidebar__item m={'loading'}>
              {t('loading')}
              <i />
            </CollectionSidebar__item>
          </CollectionSidebar>
        }
        <ListSearchSummary
            assetDescriptor={t('library item')}
            assetDescriptorPlural={t('library items')}
            searchContext={this.state.searchContext}
          />

        <SearchCollectionList
            showDefault={true}
            searchContext={this.state.searchContext}
          />
      </ui.Panel>
      );
  },
});

export default LibrarySearchableList;
