import {generatePath} from 'react-router-dom';
import singleProcessingStore, {SingleProcessingTabs} from 'js/components/processing/singleProcessingStore';
import {router, routerIsActive} from 'js/router/legacy';
import {ROUTES, PROCESSING_ROUTES} from 'jsapp/js/router/routerConstants';

/**
 * Small helper function that takes given route string and applies current
 * params from `singleProcessingStore` to it.
 */
function applyCurrentRouteParams(targetRoute: string) {
  const uid = singleProcessingStore.currentAssetUid;
  const qpath = singleProcessingStore.currentQuestionQpath;
  const submissionEditId = singleProcessingStore.currentSubmissionEditId;
  return generatePath(targetRoute, {uid, qpath, submissionEditId});
}

/**
 * DRY function for checking if given processing route is active (i.e. if given
 * tab is active)
 */
export function isProcessingRouteActive(targetRoute: string) {
  return routerIsActive(applyCurrentRouteParams(targetRoute));
}

export function getActiveTab(): SingleProcessingTabs | undefined {
  if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSCRIPT)) {
    return SingleProcessingTabs.Transcript;
  }
  if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSLATIONS)) {
    return SingleProcessingTabs.Translations;
  }
  if (isProcessingRouteActive(PROCESSING_ROUTES.ANALYSIS)) {
    return SingleProcessingTabs.Analysis;
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

  const path = generatePath(targetRoute, {uid: assetUid, qpath, submissionEditId});
  router!.navigate(path);
}
