/*
 * NOTE: before using this file to check if route matches current route, please
 * try using react router way (we have it set up in `mixins.es6` as
 * `contextRouter` methods)
 *
 * This file has a list of functions that allows for simple checking if given
 * route matches current route. It uses hashHistory from react router and a list
 * of defined ROUTES.
 */

import {hashHistory} from 'react-router';
import {
  ROUTES,
  PATHS,
} from 'js/router/routerConstants';

export function redirectToLogin() {
  window.location.replace(getLoginUrl());
}

export function getLoginUrl() {
  let url = PATHS.LOGIN;
  const currentLoc = hashHistory.getCurrentLocation();
  if (currentLoc?.pathname) {
    const nextUrl = encodeURIComponent(`/#${currentLoc.pathname}`);
    // add redirection after logging in to current page
    url += `?next=${nextUrl}`;
  }
  return url;
}

export function getCurrentPath(): string {
  return hashHistory.getCurrentLocation().pathname;
}

/*
 * A list of functions that match routes defined in constants
 */

export function isAccountSettingsRoute(): boolean {
  return getCurrentPath() === ROUTES.ACCOUNT_SETTINGS;
}

export function isChangePasswordRoute(): boolean {
  return getCurrentPath() === ROUTES.CHANGE_PASSWORD;
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

export function isFormsRoute(): boolean {
  return getCurrentPath() === ROUTES.FORMS;
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

export function isFormDataRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_DATA.replace(':uid', uid);
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

export function isFormSettingsRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_SETTINGS.replace(':uid', uid);
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

export function isFormKobocatRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_KOBOCAT.replace(':uid', uid);
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
export function getRouteAssetUid(): string|void {
  if (isAnyFormRoute()) {
    return getCurrentPath().split('/')[2];
  }

  if (isAnyLibraryItemRoute()) {
    return getCurrentPath().split('/')[3];
  }
}
