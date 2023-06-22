import findIndex from 'lodash.findindex';
import Reflux from 'reflux';
import {when} from 'mobx';
import sessionStore from 'js/stores/session';
import {actions} from 'js/actions';
import {isAnyLibraryRoute} from 'js/router/routerUtils';
import {ASSET_TYPES} from 'js/constants';
import type {
  AssetResponse,
  AssetsResponse,
  DeleteAssetResponse,
} from 'js/dataInterface';
import {router} from 'js/router/legacy';

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
    actions.library.getCollections.completed.listen(this.onGetCollectionsCompleted.bind(this));
    actions.library.getCollections.failed.listen(this.onGetCollectionsFailed.bind(this));
    // NOTE: this could update the list of collections, but currently nothing is using
    // these parts of data that will be updated by this, thus it is commented out:
    // // actions.library.moveToCollection.completed.listen(this.onMoveToCollectionCompleted.bind(this));
    actions.resources.loadAsset.completed.listen(this.onAssetChangedOrCreated.bind(this));
    actions.resources.updateAsset.completed.listen(this.onAssetChangedOrCreated.bind(this));
    actions.resources.cloneAsset.completed.listen(this.onAssetChangedOrCreated.bind(this));
    actions.resources.createResource.completed.listen(this.onAssetChangedOrCreated.bind(this));
    actions.resources.deleteAsset.completed.listen(this.onDeleteAssetCompleted.bind(this));

    when(() => sessionStore.isLoggedIn, this.startupStore.bind(this));
    setTimeout(() => router!.subscribe(this.startupStore.bind(this)));

    this.startupStore();
  }

  /** NOTE: This method relies on few different observable properties. */
  startupStore() {
    if (
      // We only initialize this once
      !this.isInitialised &&
      // If user enters the app through most common route (i.e. logging in),
      // they end up on My Projects - we don't load collections then, only wait
      // for a moment when they navigate to Library. But if user is entering
      // the app directly at Library, we need to fetch data immediately.
      isAnyLibraryRoute() &&
      // This store requires user who is logged in, and due to race condition we
      // often end up initializing it before session store is ready, thus we
      // need to wait for it a bit.
      sessionStore.isLoggedIn &&
      // Avoid unnecessary duplicate calls
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
      asset.owner__username === sessionStore.currentAccount.username
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
      owner: sessionStore.currentAccount.username,
      pageSize: 0 // zero gives all results with no limit
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
