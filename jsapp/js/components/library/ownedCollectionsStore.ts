import findIndex from 'lodash.findindex';
import Reflux from 'reflux';
import {hashHistory} from 'react-router';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {isAnyLibraryRoute} from 'js/router/routerUtils';
import {ASSET_TYPES} from 'js/constants';
import type {
  AssetResponse,
  AssetsResponse,
  DeleteAssetResponse,
} from 'js/dataInterface';

export interface OwnedCollectionsStoreData {
  isFetchingData: boolean;
  collections: AssetResponse[];
}

class OwnedCollectionsStore extends Reflux.Store {
  isInitialised = false;

  data: OwnedCollectionsStoreData = {
    isFetchingData: false,
    collections: [],
  };

  init() {
    hashHistory.listen(this.startupStore);
    stores.session.listen(this.startupStore);
    actions.library.getCollections.completed.listen(this.onGetCollectionsCompleted);
    actions.library.getCollections.failed.listen(this.onGetCollectionsFailed);
    // NOTE: this could update the list of collections, but currently nothing is using
    // these parts of data that will be updated by this, thus it is commented out:
    // // actions.library.moveToCollection.completed.listen(this.onMoveToCollectionCompleted);
    actions.resources.loadAsset.completed.listen(this.onAssetChangedOrCreated);
    actions.resources.updateAsset.completed.listen(this.onAssetChangedOrCreated);
    actions.resources.cloneAsset.completed.listen(this.onAssetChangedOrCreated);
    actions.resources.createResource.completed.listen(this.onAssetChangedOrCreated);
    actions.resources.deleteAsset.completed.listen(this.onDeleteAssetCompleted);

    this.startupStore();
  }

  startupStore() {
    if (
      !this.isInitialised &&
      isAnyLibraryRoute() &&
      stores.session.isLoggedIn &&
      !this.data.isFetchingData
    ) {
      this.fetchData();
    }
  }

  // methods for handling actions

  onGetCollectionsCompleted(response: AssetsResponse) {
    this.data.collections = response.results;
    this.data.isFetchingData = false;
    this.isInitialised = true;
    this.trigger(this.data);
  }

  onGetCollectionsFailed() {
    this.data.isFetchingData = false;
    this.trigger(this.data);
  }

  onAssetChangedOrCreated(asset: AssetResponse) {
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
  }

  onDeleteAssetCompleted({uid, assetType}: DeleteAssetResponse) {
    if (assetType === ASSET_TYPES.collection.id) {
      const index = findIndex(this.data.collections, {uid: uid});
      if (index !== -1) {
        this.data.collections.splice(index, 1);
        this.trigger(this.data);
      }
    }
  }

  // the method for fetching new data

  fetchData() {
    this.data.isFetchingData = true;
    this.trigger(this.data);

    actions.library.getCollections({
      owner: stores.session.currentAccount.username,
      pageSize: 0, // zero gives all results with no limit
    });
  }

  find(uid: string) {
    return this.data.collections.find((asset) => asset.uid === uid);
  }
}

/** This store keeps an up to date list of owned collections. */
const ownedCollectionsStore = new OwnedCollectionsStore();
ownedCollectionsStore.init();

export default ownedCollectionsStore;
