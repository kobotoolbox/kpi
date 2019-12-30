/**
 * library specific actions
 */

import Reflux from 'reflux';
import {dataInterface} from '../dataInterface';

const libraryActions = Reflux.createActions({
  searchMyLibraryAssets: {
    children: [
      'started',
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

// 'started' callback returns abort method immediately
libraryActions.searchMyLibraryAssets.listen((params) => {
  const xhr = dataInterface.searchMyLibraryAssets(params)
    .done(libraryActions.searchMyLibraryAssets.completed)
    .fail(libraryActions.searchMyLibraryAssets.failed);
  libraryActions.searchMyLibraryAssets.started(xhr.abort);
});

// 'started' callback returns abort method immediately
libraryActions.searchPublicCollections.listen((params) => {
  const xhr = dataInterface.searchPublicCollections(params)
    .done(libraryActions.searchPublicCollections.completed)
    .fail(libraryActions.searchPublicCollections.failed);
  libraryActions.searchPublicCollections.started(xhr.abort);
});

/**
 * @param {string} collectionUrl
 */
libraryActions.subscribeToCollection.listen((collectionUrl) => {
  dataInterface.subscribeToCollection(collectionUrl)
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

libraryActions.getCollections.listen((params) => {
  dataInterface.getCollections(params)
    .done(libraryActions.getCollections.completed)
    .fail(libraryActions.getCollections.failed);
});

export default libraryActions;
