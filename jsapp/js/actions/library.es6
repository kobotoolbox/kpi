/**
 * library specific actions
 */

import Reflux from 'reflux';
import {dataInterface} from 'js/dataInterface';
import {notify} from 'utils';

const libraryActions = Reflux.createActions({
  searchMyCollectionAssets: {
    children: [
      'started',
      'completed',
      'failed'
    ]
  },
  searchMyLibraryAssets: {
    children: [
      'started',
      'completed',
      'failed'
    ]
  },

  searchMyCollectionMetadata: {
    children: [
      'completed',
      'failed'
    ]
  },

  searchMyLibraryMetadata: {
    children: [
      'completed',
      'failed'
    ]
  },

  searchPublicCollections: {
    children: [
      'started',
      'completed',
      'failed'
    ]
  },

  searchPublicCollectionsMetadata: {
    children: [
      'completed',
      'failed'
    ]
  },

  subscribeToCollection: {
    children: [
      'completed',
      'failed'
    ]
  },

  unsubscribeFromCollection: {
    children: [
      'completed',
      'failed'
    ]
  },

  moveToCollection: {
    children: [
      'completed',
      'failed'
    ]
  },

  getCollections: {
    children: [
      'completed',
      'failed'
    ]
  },
});

/**
 * Gets single collection's assets
 *
 * @param {object} params
 */
libraryActions.searchMyCollectionAssets.listen((params) => {
  const xhr = dataInterface.searchMyCollectionAssets(params)
    .done(libraryActions.searchMyCollectionAssets.completed)
    .fail(libraryActions.searchMyCollectionAssets.failed);
  libraryActions.searchMyCollectionAssets.started(xhr.abort);
});

/**
 * Gets library assets and metadata (with a flag)
 * Note: `started` callback returns abort method immediately
 * @param {object} params
 */
libraryActions.searchMyLibraryAssets.listen((params) => {
  const xhr = dataInterface.searchMyLibraryAssets(params)
    .done(libraryActions.searchMyLibraryAssets.completed)
    .fail(libraryActions.searchMyLibraryAssets.failed);
  libraryActions.searchMyLibraryAssets.started(xhr.abort);
});


/**
 * Gets metadata for a single collection's assets
 * @param {object} params
 */
libraryActions.searchMyCollectionMetadata.listen((params) => {
  dataInterface.searchMyCollectionMetadata(params)
    .done(libraryActions.searchMyCollectionMetadata.completed)
    .fail(libraryActions.searchMyCollectionMetadata.failed);
});

/**
 * Gets metadata for library assets
 * @param {object} params
 */
libraryActions.searchMyLibraryMetadata.listen((params) => {
  dataInterface.searchMyLibraryMetadata(params)
    .done(libraryActions.searchMyLibraryMetadata.completed)
    .fail(libraryActions.searchMyLibraryMetadata.failed);
});

/**
 * Gets public collections and metadata (with a flag)
 * Note: `started` callback returns abort method immediately
 * @param {object} params
 */
libraryActions.searchPublicCollections.listen((params) => {
  const xhr = dataInterface.searchPublicCollections(params)
    .done(libraryActions.searchPublicCollections.completed)
    .fail(libraryActions.searchPublicCollections.failed);
  libraryActions.searchPublicCollections.started(xhr.abort);
});

/**
 * Gets metadata for public collections
 * @param {object} params
 */
libraryActions.searchPublicCollectionsMetadata.listen((params) => {
  dataInterface.searchPublicCollectionsMetadata(params)
    .done(libraryActions.searchPublicCollectionsMetadata.completed)
    .fail(libraryActions.searchPublicCollectionsMetadata.failed);
});

/**
 * @param {string} assetUrl - url of target collection.
 */
libraryActions.subscribeToCollection.listen((assetUrl) => {
  dataInterface.subscribeToCollection(assetUrl)
    .done(libraryActions.subscribeToCollection.completed)
    .fail(libraryActions.subscribeToCollection.failed);
});

/**
 * @param {string} assetUid - uid of target collection.
 */
libraryActions.unsubscribeFromCollection.listen((assetUid) => {
  dataInterface.unsubscribeFromCollection(assetUid)
    .done(libraryActions.unsubscribeFromCollection.completed)
    .fail(libraryActions.unsubscribeFromCollection.failed);
});

/**
 * Moves asset to a collection.
 * @param {string} assetUid
 * @param {string} collectionUrl
 */
libraryActions.moveToCollection.listen((assetUid, collectionUrl) => {
  dataInterface.patchAsset(assetUid, {parent: collectionUrl})
    .done(libraryActions.moveToCollection.completed)
    .fail(libraryActions.moveToCollection.failed);
});

/**
 * Gets a list of collections.
 * @param {object} params
 * @param {string} [params.owner]
 * @param {number} [params.pageSize]
 * @param {number} [params.page]
 */
libraryActions.getCollections.listen((params) => {
  dataInterface.getCollections(params)
    .done(libraryActions.getCollections.completed)
    .fail(libraryActions.getCollections.failed);
});

// global notifications for actions

libraryActions.moveToCollection.completed.listen((asset) => {
  if (asset.parent === null) {
    notify(t('Successfuly removed from collection'));
  } else {
    notify(t('Successfuly moved to collection'));
  }
});
libraryActions.moveToCollection.failed.listen(() => {
  notify(t('Move to collection failed'), 'error');
});

const onAnySearchFailed = (response) => {
  if (response.statusText !== 'abort') {
    notify(response.responseJSON?.detail || t('Failed to get the results'), 'error');
  }
};

libraryActions.searchMyLibraryAssets.failed.listen(onAnySearchFailed);
libraryActions.searchMyLibraryMetadata.failed.listen(onAnySearchFailed);
libraryActions.searchPublicCollections.failed.listen(onAnySearchFailed);
libraryActions.searchPublicCollectionsMetadata.failed.listen(onAnySearchFailed);

export default libraryActions;
