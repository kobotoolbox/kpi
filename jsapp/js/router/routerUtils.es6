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

export function getCurrentPath() {
  return hashHistory.getCurrentLocation().pathname;
}

/*
 * A list of functions that match routes defined in constants
 */

export function isAccountSettingsRoute() {
  return getCurrentPath() === ROUTES.ACCOUNT_SETTINGS;
}

export function isChangePasswordRoute() {
  return getCurrentPath() === ROUTES.CHANGE_PASSWORD;
}

export function isLibraryRoute() {
  return getCurrentPath() === ROUTES.LIBRARY;
}

export function isMyLibraryRoute() {
  return getCurrentPath() === ROUTES.MY_LIBRARY;
}

export function isPublicCollectionsRoute() {
  return getCurrentPath() === ROUTES.PUBLIC_COLLECTIONS;
}

export function isNewLibraryItemRoute() {
  return getCurrentPath() === ROUTES.NEW_LIBRARY_ITEM;
}

export function isLibraryItemRoute(uid) {
  return getCurrentPath() === ROUTES.LIBRARY_ITEM.replace(':uid', uid);
}

export function isEditLibraryItemRoute(uid) {
  return getCurrentPath() === ROUTES.EDIT_LIBRARY_ITEM.replace(':uid', uid);
}

export function isNewLibraryChildRoute(uid) {
  return getCurrentPath() === ROUTES.NEW_LIBRARY_CHILD.replace(':uid', uid);
}

export function isLibraryItemJsonRoute(uid) {
  return getCurrentPath() === ROUTES.LIBRARY_ITEM_JSON.replace(':uid', uid);
}

export function isLibraryItemXformRoute(uid) {
  return getCurrentPath() === ROUTES.LIBRARY_ITEM_XFORM.replace(':uid', uid);
}

export function isFormsRoute() {
  return getCurrentPath() === ROUTES.FORMS;
}

export function isFormRoute(uid) {
  return getCurrentPath() === ROUTES.FORM.replace(':uid', uid);
}

export function isFormJsonRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_JSON.replace(':uid', uid);
}

export function isFormXformRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_XFORM.replace(':uid', uid);
}

export function isFormEditRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_EDIT.replace(':uid', uid);
}

export function isFormSummaryRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_SUMMARY.replace(':uid', uid);
}

export function isFormLandingRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_LANDING.replace(':uid', uid);
}

export function isFormDataRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_DATA.replace(':uid', uid);
}

export function isFormReportRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_REPORT.replace(':uid', uid);
}

export function isFormReportOldRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_REPORT_OLD.replace(':uid', uid);
}

export function isFormTableRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_TABLE.replace(':uid', uid);
}

export function isFormDownloadsRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_DOWNLOADS.replace(':uid', uid);
}

export function isFormGalleryRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_GALLERY.replace(':uid', uid);
}

export function isFormMapRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_MAP.replace(':uid', uid);
}

export function isFormMapByRoute(uid, viewby) {
  return getCurrentPath() === ROUTES.FORM_MAP_BY.replace(':uid', uid).replace(':viewby', viewby);
}

export function isFormSettingsRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_SETTINGS.replace(':uid', uid);
}

export function isFormMediaRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_MEDIA.replace(':uid', uid);
}

export function isFormSharingRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_SHARING.replace(':uid', uid);
}

export function isFormRestRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_REST.replace(':uid', uid);
}

export function isFormRestHookRoute(uid, hookUid) {
  return getCurrentPath() === ROUTES.FORM_REST_HOOK.replace(':uid', uid).replace(':hookUid', hookUid);
}

export function isFormKobocatRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_KOBOCAT.replace(':uid', uid);
}

export function isFormResetRoute(uid) {
  return getCurrentPath() === ROUTES.FORM_RESET.replace(':uid', uid);
}

/*
 * Additional functions
 */

export function isAnyFormsRoute() {
  return getCurrentPath().startsWith(ROUTES.FORMS);
}

export function isAnyLibraryRoute() {
  return getCurrentPath().startsWith(ROUTES.LIBRARY);
}

/**
 * Checks if on any `/library/asset/…` route.
 */
export function isAnyLibraryItemRoute() {
  // disregard the `:uid` parameter in url, as we are interested in any asset uid
  return getCurrentPath().startsWith(ROUTES.LIBRARY_ITEM.replace(':uid', ''));
}

/**
 * Checks if on any `/forms/…` route.
 */
export function isAnyFormRoute() {
  // disregard the `:uid` parameter in url, as we are interested in any asset uid
  return getCurrentPath().startsWith(ROUTES.FORM.replace(':uid', ''));
}

/**
 * @returns {string|undefined} returns asset uid from path if there is any
 */
export function getRouteAssetUid() {
  if (isAnyFormRoute()) {
    return getCurrentPath().split('/')[2];
  }

  if (isAnyLibraryItemRoute()) {
    return getCurrentPath().split('/')[3];
  }
}
