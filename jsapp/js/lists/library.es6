import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';
// import Dropzone from '../libs/dropzone';

import searches from '../searches';
import mixins from '../mixins';
import stores from '../stores';
import bem from '../bem';
import ui from '../ui';
import {dataInterface} from '../dataInterface';
import SearchCollectionList from '../components/searchcollectionlist';
import {
  ListSearchSummary,
} from '../components/list';
import {
  t,
  customPromptAsync,
  customConfirmAsync,
} from '../utils';

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
        {'label': t('Library'), 'to': 'library'}
      ];
      stores.pageState.setHeaderBreadcrumb(headerBreadcrumb);

      stores.pageState.setAssetNavPresent(false);
      stores.pageState.setDrawerHidden(false);
      stores.pageState.setHeaderHidden(false);
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
  // clickFilterByCollection (evt) {
  //   var data = $(evt.currentTarget).data();
  //   if (data.collectionUid) {
  //     this.filterByCollection(data.collectionUid);
  //   } else {
  //     this.filterByCollection(false);
  //   }
  // },
  // filterByCollection (collectionUid) {
  //   if (collectionUid) {
  //     this.quietUpdateStore({
  //       parentUid: collectionUid,
  //     });
  //   } else {
  //     this.quietUpdateStore({
  //       parentUid: false,
  //     });
  //   }
  //   this.searchValue();
  //   this.setState({
  //     filteredCollectionUid: collectionUid,
  //   });
  // },
  // createCollection () {
  //   customPromptAsync('collection name?').then((val)=>{
  //     dataInterface.createCollection({
  //       name: val,
  //     }).then((data)=>{
  //       this.queryCollections();
  //     });
  //   });
  // },
  // deleteCollection (evt) {
  //   evt.preventDefault();
  //   var collectionUid = $(evt.currentTarget).data('collection-uid');
  //   customConfirmAsync(`${t(
  //       'Are you sure you want to delete this collection?'
  //     )} ${t(
  //       'This action cannot be undone.'
  //       )}`).then(()=>{
  //     var qc = () => this.queryCollections();
  //     dataInterface.deleteCollection({uid: collectionUid}).then(qc).catch(qc);
  //   });
  // },
  render () {
    return (
      <ui.Panel>

        <SearchCollectionList
            showDefault={true}
            searchContext={this.state.searchContext}
          />

        <ListSearchSummary
            assetDescriptor={t('library item')}
            assetDescriptorPlural={t('library items')}
            searchContext={this.state.searchContext}
          />
      </ui.Panel>
      );
  }
});

export default LibrarySearchableList;
