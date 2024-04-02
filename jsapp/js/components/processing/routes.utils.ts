// This is a collection of various utility functions related to processing
// routes and navigation.

import {generatePath} from 'react-router-dom';
import type {ProcessingTabName} from 'js/components/processing/singleProcessingStore';
import {router, routerIsActive} from 'js/router/legacy';
import {ROUTES, PROCESSING_ROUTES} from 'js/router/routerConstants';
import {getSingleProcessingRouteParameters} from 'js/router/routerUtils';

/**
 * Small helper function that takes given route string and applies current
 * params from `singleProcessingStore` to it.
 */
function applyCurrentRouteParams(targetRoute: string) {
  const routeParams = getSingleProcessingRouteParameters();

  return generatePath(targetRoute, {
    uid: routeParams.uid || '',
    qpath: routeParams.qpath || '',
    submissionEditId: routeParams.submissionEditId || '',
  });
}

/**
 * Checks if given processing route is active (useful for checking if given tab
 * is active)
 */
export function isProcessingRouteActive(targetRoute: string) {
  return routerIsActive(applyCurrentRouteParams(targetRoute));
}

/**
 * Returns an active tab name. It works by matching the route (with a tab in it)
 * to the `ProcessingTabName`.
 */
export function getActiveTab(): ProcessingTabName | undefined {
  if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSCRIPT)) {
    return 'transcript';
  }
  if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSLATIONS)) {
    return 'translations';
  }
  if (isProcessingRouteActive(PROCESSING_ROUTES.ANALYSIS)) {
    return 'analysis';
  }
  // Should not happen
  return undefined;
}

/**
 * Navigates to different tab within the same question and submission as
 * currently loaded. It replaces params with current values from the
 * `singleProcessingStore`.
 */
export function goToTabRoute(targetTabRoute: string) {
  router!.navigate(applyCurrentRouteParams(targetTabRoute));
}

/**
 * Navigates to processing view for given response to question in a project.
 *
 * Optionally can remain on the same tab as currently loaded (if processing is
 * opened right now). Default functionality is to navigate to the root route
 * for processing, thus letting the routes code handle the tab selection.
 */
export function goToProcessing(
  assetUid: string,
  qpath: string,
  submissionEditId: string,
  remainOnSameTab?: boolean
) {
  let targetRoute: string = ROUTES.FORM_PROCESSING_ROOT;

  if (remainOnSameTab) {
    if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSCRIPT)) {
      targetRoute = PROCESSING_ROUTES.TRANSCRIPT;
    } else if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSLATIONS)) {
      targetRoute = PROCESSING_ROUTES.TRANSLATIONS;
    } else if (isProcessingRouteActive(PROCESSING_ROUTES.ANALYSIS)) {
      targetRoute = PROCESSING_ROUTES.ANALYSIS;
    }
  }

  const path = generatePath(targetRoute, {
    uid: assetUid,
    qpath,
    submissionEditId,
  });
  router!.navigate(path);
}

interface ProcessingPathParts {
  assetUid: string;
  qpath: string;
  submissionEditId: string;
  tab: ProcessingTabName;
}

/**
 * For given processing path, returns all of it's params and parts.
 */
export function getProcessingPathParts(path: string): ProcessingPathParts {
  const pathArray = path.split('/');

  // We assume this will always be correct :fingers_crossed:
  const pathTabPart = pathArray[7] as ProcessingTabName;

  return {
    assetUid: pathArray[2],
    qpath: pathArray[5],
    submissionEditId: pathArray[6],
    tab: pathTabPart,
  };
}
