import {hashHistory} from 'react-router';

/**
 * Checks simply wheter on library route
 */
export function isOnLibraryRoute() {
  return hashHistory.getCurrentLocation().pathname.split('/')[1] === 'library';
}
