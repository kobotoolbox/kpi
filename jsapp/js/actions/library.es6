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

libraryActions.getCollections.listen((params) => {
  dataInterface.getCollections(params)
    .done(libraryActions.getCollections.completed)
    .fail(libraryActions.getCollections.failed);
});

export default libraryActions;
