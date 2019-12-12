import Reflux from 'reflux';
import {stores} from 'js/stores';
import {actions} from 'js/actions';

const ownedCollectionsStore = Reflux.createStore({
  init() {
    this.data = {
      isFetchingData: true,
      collections: []
    };

    // TODO update collections list whenever a new one is created or existing one is changed

    this.listenTo(stores.session, this.onSessionChanged);
    this.listenTo(actions.library.getCollections.completed, this.onGetCollectionsCompleted);
    this.listenTo(actions.library.getCollections.failed, this.onGetCollectionsFailed);

    this.fetchData();
  },

  // methods for handling actions

  onSessionChanged(storeData) {
    if (storeData.currentAccount) {
      this.fetchData();
    }
  },

  onGetCollectionsCompleted(response) {
    this.data.collections = response.results.filter((asset) => {
      return asset.owner__username === stores.session.currentAccount.username;
    });
    this.data.isFetchingData = false;
    this.trigger(this.data);
  },

  onGetCollectionsFailed() {
    this.data.isFetchingData = false;
    this.trigger(this.data);
  },

  // the method for fetching new data

  fetchData() {
    this.data.isFetchingData = true;
    this.trigger(this.data);

    actions.library.getCollections({
      pageSize: 9999 // big magic number, as we want to avoid pagination
    });
  },
});

export default ownedCollectionsStore;
