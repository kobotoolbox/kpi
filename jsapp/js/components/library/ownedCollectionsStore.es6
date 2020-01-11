import _ from 'underscore';
import Reflux from 'reflux';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {ASSET_TYPES} from 'js/constants';

const ownedCollectionsStore = Reflux.createStore({
  init() {
    this.data = {
      isFetchingData: true,
      collections: []
    };

    stores.session.listen(this.onSessionChanged);
    actions.library.getCollections.completed.listen(this.onGetCollectionsCompleted);
    actions.library.getCollections.failed.listen(this.onGetCollectionsFailed);
    actions.library.moveToCollection.completed.listen(this.onMoveToCollectionCompleted);
    actions.resources.loadAsset.completed.listen(this.onAssetChangedOrCreated);
    actions.resources.updateAsset.completed.listen(this.onAssetChangedOrCreated);
    actions.resources.cloneAsset.completed.listen(this.onAssetChangedOrCreated);
    actions.resources.createResource.completed.listen(this.onAssetChangedOrCreated);
    actions.resources.deleteAsset.completed.listen(this.onDeleteAssetCompleted);

    if (stores.session.currentAccount) {
      this.fetchData();
    }
  },

  // methods for handling actions

  onSessionChanged(storeData) {
    if (storeData.currentAccount) {
      this.fetchData();
    }
  },

  onGetCollectionsCompleted(response) {
    this.data.collections = response.results;
    this.data.isFetchingData = false;
    this.trigger(this.data);
  },

  onGetCollectionsFailed() {
    this.data.isFetchingData = false;
    this.trigger(this.data);
  },

  onMoveToCollectionCompleted(asset) {
    // TODO update this.data.collections collection children count?
  },

  onAssetChangedOrCreated(asset) {
    if (
      asset.asset_type === ASSET_TYPES.collection.id &&
      asset.owner__username === stores.session.currentAccount.username
    ) {
      let wasUpdated = false;
      for (let i = 0; i < this.data.collections.length; i++) {
        if (this.data.collections[i].uid === asset.uid) {
          this.data.collections[i] = asset;
          wasUpdated = true;
          break;
        }
      }
      if (!wasUpdated) {
        this.data.collections.push(asset);
      }
      this.trigger(this.data);
    }
  },

  onDeleteAssetCompleted({uid, assetType}) {
    if (assetType === ASSET_TYPES.collection.id) {
      const index = _.findIndex(this.data.collections, {uid: uid});
      if (index !== -1) {
        this.data.collections.splice(index, 1);
        this.trigger(this.data);
      }
    }
  },

  // the method for fetching new data

  fetchData() {
    this.data.isFetchingData = true;
    this.trigger(this.data);

    actions.library.getCollections({
      owner: stores.session.currentAccount.username,
      pageSize: 0 // zero gives all results with no limit
    });
  },

  find(uid) {
    return this.data.collections.find((asset) => {return asset.uid === uid;});
  }
});

export default ownedCollectionsStore;
