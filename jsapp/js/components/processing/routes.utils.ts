// This is a collection of various utility functions related to processing
// routes and navigation.

import {generatePath, matchPath, useNavigate} from 'react-router-dom';
import {router} from 'js/router/legacy';
import {ROUTES, PROCESSING_ROUTES, PROCESSING_ROUTE_GENERIC} from 'js/router/routerConstants';
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
  assetUid: string;
  xpath: string;
  submissionEditId: string;
  tabName?: ProcessingTab;
}

/**
 * For given processing path, returns all of it's params and parts.
 */
export function getProcessingRouteParts(path: string): ProcessingRouteParts {
  const output: ProcessingRouteParts = {
    assetUid: '',
    xpath: '',
    submissionEditId: '',
  };

  // Step 1. Remove query string from path.
  const targetPath = path.split('?')[0];

  // Step 2. Generate match profile (an object with parameters from the path).
  let matchProfile = matchPath(PROCESSING_ROUTE_GENERIC, targetPath);

  // Step 3. If a root route was passed (i.e. one without tab name), we need to
  // match it again, this time against different pattern.
  if (!matchProfile) {
    matchProfile = matchPath(ROUTES.FORM_PROCESSING_ROOT, targetPath);
  }

  if (!matchProfile) {
    return output;
  }

  // Step 4. Assign all the found values to output
  output.assetUid = matchProfile.params.uid as string;
  output.xpath = decodeURLParamWithSlash(matchProfile.params.xpath || '') as string;
  output.submissionEditId = matchProfile.params.submissionEditId as string;
  if (
    'tabName' in matchProfile.params &&
    Object.values(ProcessingTab).includes(matchProfile.params.tabName as ProcessingTab)
  ) {
    output.tabName = matchProfile.params.tabName as ProcessingTab;
  }
  return output;
};

/**
 * Restore previously encoded value with encodeURLParamWithSlash to its
 * original value
 *
 * @param value
 */
export function decodeURLParamWithSlash(value: string) {
  return value.replace(/\|/g, '/');
}

/**
 * Replace slashes ("/") with pipe ("|")
 *
 * React router seems to decode `%2F` automatically, thus we cannot use
 * `encodeComponentURI()` to pass params with encoded slashes (i.e.: %2F)
 * to `router.navigate()` without navigating to url with decoded slashes ("/")
 * @param value
 */
export function encodeURLParamWithSlash(value: string) {
  return encodeURIComponent(value.replace(/\//g, '|'));
}

export function getCurrentProcessingRouteParts(): ProcessingRouteParts {
  return getProcessingRouteParts(getCurrentPath());
}

/**
 * Small helper function that takes given route string and applies current
 * params from `singleProcessingStore` to it.
 */
function applyCurrentRouteParams(targetRoute: string) {
  const routeParams = getProcessingRouteParts(getCurrentPath());

  return generatePath(targetRoute, {
    uid: routeParams.assetUid,
    xpath: encodeURLParamWithSlash(routeParams.xpath),
    submissionEditId: routeParams.submissionEditId,
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
    processingRouteParts.xpath
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
  // We need to apply actual values for the route definition `:param`s here.
  // After that we use `decodeURI` to ensure that `|` in the test route is the
  // same as `|` in the `getCurrentPath`. Without this we would be comparing
  // string that could be "exactly" the same, just one containing `|` and
  // the other `%7C` (ASCII for `|`) - resulting in incorrect `false`.
  const routeToTest = decodeURI(applyCurrentRouteParams(targetRoute));
  // Sometimes current path containts `|` and sometimes with `%7C` so we need to
  // be extra safe here.
  const currentPath = decodeURI(getCurrentPath());
  return currentPath.startsWith(routeToTest);
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
  xpath: string,
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
    xpath: encodeURLParamWithSlash(xpath),
    submissionEditId,
  });
  router!.navigate(path);
}
