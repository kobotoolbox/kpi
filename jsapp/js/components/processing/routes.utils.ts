// This is a collection of various utility functions related to processing
// routes and navigation.

import {generatePath} from 'react-router-dom';
import {router} from 'js/router/legacy';
import {ROUTES, PROCESSING_ROUTES} from 'js/router/routerConstants';
import {getCurrentPath} from 'js/router/routerUtils';

/**
 * This is a list of available tabs in Single Processing View. Each tab uses
 * the same string as the one being used in the matching route.
 */
export enum ProcessingTab {
  Transcript = 'transcript',
  Translations = 'translations',
  Analysis = 'analysis',
}

const TabToRouteMap: Map<ProcessingTab, string> = new Map([
  [ProcessingTab.Transcript, PROCESSING_ROUTES.TRANSCRIPT],
  [ProcessingTab.Translations, PROCESSING_ROUTES.TRANSLATIONS],
  [ProcessingTab.Analysis, PROCESSING_ROUTES.ANALYSIS],
]);

interface ProcessingRouteParts {
  assetUid?: string;
  qpath?: string;
  submissionEditId?: string;
  tab?: ProcessingTab;
}

/**
 * For given processing path, returns all of it's params and parts. If path is
 * not provided, function is working on current path.
 */
export function getProcessingRouteParts(path?: string): ProcessingRouteParts {
  // Step 1. Fallback to current path
  let targetPath = path;
  if (!targetPath) {
    targetPath = getCurrentPath();
  }

  // Step 2. We get the parts of checked path, and we drop any existing query
  // params to not pollute the outcome
  const pathArray = targetPath.split('?')[0].split('/');

  // Step 3. Get all indexes of all the parts from the route definition.
  // These checks are a bit annoyting to have, but we want to avoid false
  // positives, and path splitting is very vague. The idea is to make sure
  // that the provided path has all necessary static parts of the processing
  // route.
  const defRouteArray = PROCESSING_ROUTES.ANALYSIS.split('/');
  const formsPartIndex = defRouteArray.indexOf('forms');
  const uidPartIndex = defRouteArray.indexOf(':uid');
  const dataPartIndex = defRouteArray.indexOf('data');
  const processingPartIndex = defRouteArray.indexOf('processing');
  const qpathPartIndex = defRouteArray.indexOf(':qpath');
  const submissionPartIndex = defRouteArray.indexOf(':submissionEditId');
  const tabPartIndex = defRouteArray.indexOf('analysis');

  // Step 4. Make sure all the static parts exist in the checked path
  if (
    pathArray[formsPartIndex] !== 'forms' ||
    pathArray[dataPartIndex] !== 'data' ||
    pathArray[processingPartIndex] !== 'processing'
  ) {
    // Not processing path, so we return "empty" results
    return {
      assetUid: undefined,
      qpath: undefined,
      submissionEditId: undefined,
      tab: undefined,
    };
  }

  // Step 5. Get path part
  let pathTabPart;
  if (pathArray[tabPartIndex]) {
    // We only assign it (and cast it) when it actually exists
    pathTabPart = pathArray[tabPartIndex] as ProcessingTab;
  }

  return {
    assetUid: pathArray[uidPartIndex],
    qpath: pathArray[qpathPartIndex],
    submissionEditId: pathArray[submissionPartIndex],
    tab: pathTabPart,
  };
}

/**
 * Small helper function that takes given route string and applies current
 * params from `singleProcessingStore` to it.
 */
function applyCurrentRouteParams(targetRoute: string) {
  const routeParams = getProcessingRouteParts(getCurrentPath());

  return generatePath(targetRoute, {
    uid: routeParams.assetUid || '',
    qpath: routeParams.qpath || '',
    submissionEditId: routeParams.submissionEditId || '',
  });
}

/**
 * Checks if given path is a processing route (any of them). For code simplicity
 * sake, we allow passing `undefined`.
 */
export function isAnyProcessingRoute(path?: string): boolean {
  if (path === undefined) {
    return false;
  }

  const processingRouteParts = getProcessingRouteParts(path);
  return Boolean(
    processingRouteParts.assetUid &&
      processingRouteParts.submissionEditId &&
      processingRouteParts.qpath
  );
}

/**
 * Checks if currently loaded path is a processing route (any of them).
 */
export function isAnyProcessingRouteActive(): boolean {
  return isAnyProcessingRoute(getCurrentPath());
}

/**
 * Checks if given processing route is active (useful for checking if given tab
 * is active)
 */
export function isProcessingRouteActive(targetRoute: string) {
  return getCurrentPath().startsWith(applyCurrentRouteParams(targetRoute));
}

/**
 * Returns an active tab name. It works by matching the route (with a tab in it)
 * to the `ProcessingTab`.
 */
export function getActiveTab(): ProcessingTab | undefined {
  if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSCRIPT)) {
    return ProcessingTab.Transcript;
  }
  if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSLATIONS)) {
    return ProcessingTab.Translations;
  }
  if (isProcessingRouteActive(PROCESSING_ROUTES.ANALYSIS)) {
    return ProcessingTab.Analysis;
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
    const activeTab = getActiveTab();
    if (activeTab) {
      const activeTabRoute = TabToRouteMap.get(activeTab);
      if (activeTabRoute) {
        targetRoute = activeTabRoute;
      }
    }
  }

  const path = generatePath(targetRoute, {
    uid: assetUid,
    qpath,
    submissionEditId,
  });
  router!.navigate(path);
}
