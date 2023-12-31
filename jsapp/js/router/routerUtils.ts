/*
 * NOTE: before using this file to check if route matches current route, please
 * try using react router way (we have it set up in `mixins.tsx` as
 * `contextRouter` methods)
 *
 * This file has a list of functions that allows for simple checking if given
 * route matches current route. It uses hashHistory from react router and a list
 * of defined ROUTES.
 */

import {
  ROUTES,
  PATHS,
} from 'js/router/routerConstants';
import {PROJECTS_ROUTES} from 'js/projects/routes';

/**
 * Returns login url with a `next` parameter - after logging in, the  app will
 * redirect to the next url.
 */
export function getLoginUrl(): string {
  let url = PATHS.LOGIN;
  const currentLoc = getCurrentPath();
  if (currentLoc) {
    const nextUrl = encodeURIComponent(`/#${currentLoc}`);
    // add redirection after logging in to current page
    url += `?next=${nextUrl}`;
  }
  return url;
}

export function redirectToLogin() {
  window.location.replace(getLoginUrl());
}

export function getCurrentPath(): string {
  const route = location.hash.split('#');
  return route.length > 1 ? route[1] : '';
}

/*
 * A list of functions that match routes defined in constants
 */

export function isRootRoute(): boolean {
  // Cannot rely on `window.location.pathname` while hash router still in use
  return getCurrentPath() === ROUTES.ROOT;
}

export function isLibraryRoute(): boolean {
  return getCurrentPath() === ROUTES.LIBRARY;
}

export function isMyLibraryRoute(): boolean {
  return getCurrentPath() === ROUTES.MY_LIBRARY;
}

export function isPublicCollectionsRoute(): boolean {
  return getCurrentPath() === ROUTES.PUBLIC_COLLECTIONS;
}

export function isNewLibraryItemRoute(): boolean {
  return getCurrentPath() === ROUTES.NEW_LIBRARY_ITEM;
}

export function isLibraryItemRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.LIBRARY_ITEM.replace(':uid', uid);
}

export function isEditLibraryItemRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.EDIT_LIBRARY_ITEM.replace(':uid', uid);
}

export function isNewLibraryChildRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.NEW_LIBRARY_CHILD.replace(':uid', uid);
}

export function isLibraryItemJsonRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.LIBRARY_ITEM_JSON.replace(':uid', uid);
}

export function isLibraryItemXformRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.LIBRARY_ITEM_XFORM.replace(':uid', uid);
}

export function isAnyProjectsViewRoute() {
  return getCurrentPath() === PROJECTS_ROUTES.MY_PROJECTS || getCurrentPath().startsWith(PROJECTS_ROUTES.CUSTOM_VIEW.replace(':viewUid', ''));
}

export function isFormRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM.replace(':uid', uid);
}

export function isFormJsonRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_JSON.replace(':uid', uid);
}

export function isFormXformRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_XFORM.replace(':uid', uid);
}

export function isFormEditRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_EDIT.replace(':uid', uid);
}

export function isFormSummaryRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_SUMMARY.replace(':uid', uid);
}

export function isFormLandingRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_LANDING.replace(':uid', uid);
}

/** Note that this is `false` for sub-routes of `FORM_DATA`. */
export function isFormDataRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_DATA.replace(':uid', uid);
}

/** If on `forms/<uid>/data/…` route */
export function isAnyFormDataRoute(uid: string) {
  return getCurrentPath().startsWith(ROUTES.FORM_DATA.replace(':uid', uid));
}

export function isFormReportRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_REPORT.replace(':uid', uid);
}

export function isFormTableRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_TABLE.replace(':uid', uid);
}

export function isFormDownloadsRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_DOWNLOADS.replace(':uid', uid);
}

export function isFormGalleryRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_GALLERY.replace(':uid', uid);
}

export function isFormMapRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_MAP.replace(':uid', uid);
}

export function isFormMapByRoute(uid: string, viewby: string): boolean {
  return getCurrentPath() === ROUTES.FORM_MAP_BY.replace(':uid', uid).replace(':viewby', viewby);
}

/** Note that this is `false` for sub-routes of `FORM_SETTINGS`. */
export function isFormSettingsRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_SETTINGS.replace(':uid', uid);
}

/** If on `forms/<uid>/settings/…` route */
export function isAnyFormSettingsRoute(uid: string) {
  return getCurrentPath().startsWith(ROUTES.FORM_SETTINGS.replace(':uid', uid));
}

export function isFormMediaRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_MEDIA.replace(':uid', uid);
}

export function isFormSharingRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_SHARING.replace(':uid', uid);
}

export function isFormRestRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_REST.replace(':uid', uid);
}

export function isFormRestHookRoute(uid: string, hookUid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_REST_HOOK.replace(':uid', uid).replace(':hookUid', hookUid);
}

export function isFormSingleProcessingRoute(
  uid: string,
  qpath: string,
  submissionEditId: string
): boolean {
  return getCurrentPath() === ROUTES.FORM_PROCESSING
    .replace(':uid', uid)
    .replace(':qpath', qpath)
    .replace(':submissionEditId', submissionEditId);
}

export function isFormResetRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_RESET.replace(':uid', uid);
}

/*
 * Additional functions
 */

export function isAnyFormsRoute(): boolean {
  return getCurrentPath().startsWith(ROUTES.FORMS);
}

export function isAnyLibraryRoute(): boolean {
  return getCurrentPath().startsWith(ROUTES.LIBRARY);
}

/**
 * Checks if on any `/library/asset/…` route.
 */
export function isAnyLibraryItemRoute(): boolean {
  // disregard the `:uid` parameter in url, as we are interested in any asset uid
  return getCurrentPath().startsWith(ROUTES.LIBRARY_ITEM.replace(':uid', ''));
}

/**
 * Checks if on any `/forms/…` route.
 */
export function isAnyFormRoute(): boolean {
  // disregard the `:uid` parameter in url, as we are interested in any asset uid
  return getCurrentPath().startsWith(ROUTES.FORM.replace(':uid', ''));
}

/**
 * Returns asset uid from path if there is any
 */
export function getRouteAssetUid() {
  if (isAnyFormRoute()) {
    return getCurrentPath().split('/')[2];
  }

  if (isAnyLibraryItemRoute()) {
    return getCurrentPath().split('/')[3];
  }

  return null;
}

/** Returns parameters from path for single processing route. */
export function getSingleProcessingRouteParameters(): {
  uid: string;
  qpath: string;
  submissionEditId: string;
} {
  const splitPath = getCurrentPath().split('/');
  return {
    uid: splitPath[2],
    qpath: splitPath[5],
    submissionEditId: splitPath[6],
  };
}
