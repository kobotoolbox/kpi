// This is a collection of various utility functions related to processing
// routes and navigation.

import { generatePath, matchPath } from 'react-router-dom'
import { router } from '#/router/legacy'
import { PROCESSING_ROUTES, PROCESSING_ROUTE_GENERIC, PROCESSING_ROUTE_TRANSLATION_DETAIL, ROUTES } from '#/router/routerConstants'
import { getCurrentPath } from '#/router/routerUtils'
import { recordValues } from '#/utils'

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
])

interface ProcessingRouteParts {
  assetUid: string
  xpath: string
  submissionEditId: string
  tabName?: ProcessingTab
  languageCode?: string
}

/**
 * For given processing path, returns all of it's params and parts.
 */
export function getProcessingRouteParts(path: string): ProcessingRouteParts {
  const output: ProcessingRouteParts = {
    assetUid: '',
    xpath: '',
    submissionEditId: '',
  }

  // Step 1. Remove query string from path.
  const targetPath = path.split('?')[0]

  // Step 2. Try to match against translation detail route first (most specific)
  let matchProfile = matchPath(PROCESSING_ROUTE_TRANSLATION_DETAIL, targetPath)

  // Step 3. If not a translation detail, try generic tab route
  if (!matchProfile) {
    matchProfile = matchPath(PROCESSING_ROUTE_GENERIC, targetPath)
  }

  // Step 4. If a root route was passed (i.e. one without tab name), we need to
  // match it again, this time against different pattern.
  if (!matchProfile) {
    matchProfile = matchPath(ROUTES.FORM_PROCESSING_ROOT, targetPath)
  }

  if (!matchProfile) {
    return output
  }

  // Step 5. Assign all the found values to output
  output.assetUid = matchProfile.params.uid as string
  output.xpath = decodeURLParamWithSlash(matchProfile.params.xpath || '') as string
  output.submissionEditId = matchProfile.params.submissionEditId as string
  if (
    'tabName' in matchProfile.params &&
    recordValues(ProcessingTab).includes(matchProfile.params.tabName as ProcessingTab)
  ) {
    output.tabName = matchProfile.params.tabName as ProcessingTab
  }
  // For translation detail route, we also have languageCode
  if ('languageCode' in matchProfile.params && matchProfile.params.languageCode) {
    output.languageCode = matchProfile.params.languageCode as string
    // Translation detail routes should have Translations tab set
    output.tabName = ProcessingTab.Translations
  }
  return output
}

/**
 * Restore previously encoded value with encodeURLParamWithSlash to its
 * original value
 *
 * @param value
 */
export function decodeURLParamWithSlash(value: string) {
  return decodeURIComponent(value).replace(/\|/g, '/')
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
  // We first decode the value to ensure that
  // if it already contains encoded slashes or pipes,
  // avoiding a double-encoded value that would break the url structure.
  return encodeURIComponent(decodeURLParamWithSlash(value).replace(/\//g, '|'))
}

export function getCurrentProcessingRouteParts(): ProcessingRouteParts {
  return getProcessingRouteParts(getCurrentPath())
}

/**
 * Small helper function that takes given route string and applies current
 * params from `singleProcessingStore` to it.
 */
function applyCurrentRouteParams(targetRoute: string) {
  const routeParams = getProcessingRouteParts(getCurrentPath())

  return generatePath(targetRoute, {
    uid: routeParams.assetUid,
    xpath: encodeURLParamWithSlash(routeParams.xpath),
    submissionEditId: routeParams.submissionEditId,
  })
}

/**
 * Checks if given path is a processing route (any of them). For code simplicity
 * sake, we allow passing `undefined`.
 */
export function isAnyProcessingRoute(path?: string): boolean {
  if (path === undefined) {
    return false
  }

  const processingRouteParts = getProcessingRouteParts(path)
  return Boolean(processingRouteParts.assetUid && processingRouteParts.submissionEditId && processingRouteParts.xpath)
}

/**
 * Checks if currently loaded path is a processing route (any of them).
 */
export function isAnyProcessingRouteActive(): boolean {
  return isAnyProcessingRoute(getCurrentPath())
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
  const routeToTest = decodeURI(applyCurrentRouteParams(targetRoute))
  // Sometimes current path containts `|` and sometimes with `%7C` so we need to
  // be extra safe here.
  const currentPath = decodeURI(getCurrentPath())
  return currentPath.startsWith(routeToTest)
}

/**
 * Returns an active tab name. It works by matching the route (with a tab in it)
 * to the `ProcessingTab`.
 */
export function getActiveTab(): ProcessingTab | undefined {
  if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSCRIPT)) {
    return ProcessingTab.Transcript
  }
  if (isProcessingRouteActive(PROCESSING_ROUTES.TRANSLATIONS)) {
    return ProcessingTab.Translations
  }
  if (isProcessingRouteActive(PROCESSING_ROUTES.ANALYSIS)) {
    return ProcessingTab.Analysis
  }
  // Should not happen
  return undefined
}

/**
 * Returns the active language code if on a translation detail route.
 */
export function getActiveLanguageCode(): string | undefined {
  const routeParts = getCurrentProcessingRouteParts()
  return routeParts.languageCode
}

/**
 * Navigates to different tab within the same question and submission as
 * currently loaded. It replaces params with current values from the
 * `singleProcessingStore`.
 */
export function goToTabRoute(targetTabRoute: string) {
  router!.navigate(applyCurrentRouteParams(targetTabRoute))
}

/**
 * Navigates to processing view for given response to question in a project.
 *
 * @param assetUid - The asset UID
 * @param xpath - The question xpath
 * @param submissionEditId - The submission edit ID
 * @param targetTab - Optional specific tab to navigate to. If not provided, navigates to root (letting routes decide)
 * @param languageCode - Optional language code for translation detail route (only applies to Translations tab)
 */
export function goToProcessing(
  assetUid: string,
  xpath: string,
  submissionEditId: string,
  targetTab?: ProcessingTab,
  languageCode?: string
) {
  let targetRoute: string = ROUTES.FORM_PROCESSING_ROOT

  // If specific tab is provided, use it
  if (targetTab) {
    // Special case: if Translations tab with languageCode, use detail route
    if (targetTab === ProcessingTab.Translations && languageCode) {
      targetRoute = PROCESSING_ROUTES.TRANSLATION_DETAIL
    } else {
      const tabRoute = TabToRouteMap.get(targetTab)
      if (tabRoute) {
        targetRoute = tabRoute
      }
    }
  }

  const path = generatePath(targetRoute, {
    uid: assetUid,
    xpath: encodeURLParamWithSlash(xpath),
    submissionEditId,
    languageCode, // Will be ignored if not in the route pattern
  })
  router!.navigate(path)
}
