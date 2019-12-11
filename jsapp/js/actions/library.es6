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
});

// 'started' callback returns abort method immediately
libraryActions.searchMyLibraryAssets.listen((params) => {
  const xhr = dataInterface.searchMyLibraryAssets(params)
    .done(libraryActions.searchMyLibraryAssets.completed)
    .fail(libraryActions.searchMyLibraryAssets.failed);
  libraryActions.searchMyLibraryAssets.started(xhr.abort);
});

export default libraryActions;
