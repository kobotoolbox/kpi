import {hashHistory} from 'react-router';

/**
 * Checks if on `/library/…`
 */
export function isOnLibraryRoute() {
  return hashHistory.getCurrentLocation().pathname.split('/')[1] === 'library';
}

/**
 * Checks if on `/library/my-library/…`
 */
export function isOnMyLibraryRoute() {
  const path = hashHistory.getCurrentLocation().pathname;
  return (
    path.split('/')[1] === 'library' &&
    path.split('/')[2] === 'my-library'
  );
}

/**
 * Checks if on `/library/public-collections/…`
 */
export function isOnPublicCollectionsRoute() {
  const path = hashHistory.getCurrentLocation().pathname;
  return (
    path.split('/')[1] === 'library' &&
    path.split('/')[2] === 'public-collections'
  );
}

/**
 * Checks if on `/library/asset/…`
 */
export function isOnLibraryAssetRoute() {
  const path = hashHistory.getCurrentLocation().pathname;
  return (
    path.split('/')[1] === 'library' &&
    path.split('/')[2] === 'asset'
  );
}

/**
 * Returns current collection uid
 */
export function getCurrentLibraryAssetUID() {
  const path = hashHistory.getCurrentLocation().pathname;
  if (
    path.split('/')[1] === 'library' &&
    path.split('/')[2] === 'asset'
  ) {
    return (path.split('/')[3]);
  }
}
