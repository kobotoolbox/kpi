/*
 * NOTE: before using this file to check if route matches current route, please
 * try using react router way (we have it set up in `mixins.tsx` as
 * `contextRouter` methods)
 *
 * This file has a list of functions that allows for simple checking if given
 * route matches current route. It uses hashHistory from react router and a list
 * of defined ROUTES.
 */

import envStore from '#/envStore'
import { PATHS, PROJECTS_ROUTES, ROUTES } from '#/router/routerConstants'
import profileStore from '#/stores/profile'

/**
 * Returns login url with a `next` parameter - after logging in, the  app will
 * redirect to the next url.
 */
export function getLoginUrl(): string {
  let url = PATHS.LOGIN
  const currentLoc = getCurrentPath()
  if (currentLoc) {
    const nextUrl = encodeURIComponent(`/#${currentLoc}`)
    // add redirection after logging in to current page
    url += `?next=${nextUrl}`
  }
  return url
}

export function redirectToLogin() {
  window.location.replace(getLoginUrl())
}

/**
 * @deprecated `location.hash` is wonky during re-renders, it's safer to use router hooks
 */
export function getCurrentPath(): string {
  const route = location.hash.split('#')
  return route.length > 1 ? route[1] : ''
}

/*
 * A list of functions that match routes defined in constants.
 * All functions in this section are deprecated — use React Router's `useLocation` hook
 * and compare `location.pathname` directly instead. See projectTopTabs for an example.
 */

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isRootRoute(): boolean {
  // Cannot rely on `window.location.pathname` while hash router still in use
  return getCurrentPath() === ROUTES.ROOT
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isLibraryRoute(): boolean {
  return getCurrentPath() === ROUTES.LIBRARY
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isMyLibraryRoute(): boolean {
  return getCurrentPath() === ROUTES.MY_LIBRARY
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isPublicCollectionsRoute(): boolean {
  return getCurrentPath() === ROUTES.PUBLIC_COLLECTIONS
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isNewLibraryItemRoute(): boolean {
  return getCurrentPath() === ROUTES.NEW_LIBRARY_ITEM
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isLibraryItemRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.LIBRARY_ITEM.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isEditLibraryItemRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.EDIT_LIBRARY_ITEM.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isNewLibraryChildRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.NEW_LIBRARY_CHILD.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isLibraryItemJsonRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.LIBRARY_ITEM_JSON.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isLibraryItemXformRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.LIBRARY_ITEM_XFORM.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isAnyProjectsViewRoute() {
  return (
    getCurrentPath() === PROJECTS_ROUTES.MY_PROJECTS ||
    getCurrentPath() === PROJECTS_ROUTES.MY_ORG_PROJECTS ||
    getCurrentPath().startsWith(PROJECTS_ROUTES.CUSTOM_VIEW.replace(':viewUid', ''))
  )
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormJsonRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_JSON.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormXformRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_XFORM.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormEditRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_EDIT.replace(':uid', uid)
}

/**
 * Note that this is `false` for sub-routes of `FORM_DATA`.
 * @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern.
 */
export function isFormDataRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_DATA.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormReportRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_REPORT.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormTableRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_TABLE.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormDownloadsRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_DOWNLOADS.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormGalleryRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_GALLERY.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormMapRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_MAP.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormMapByRoute(uid: string, viewby: string): boolean {
  return getCurrentPath() === ROUTES.FORM_MAP_BY.replace(':uid', uid).replace(':viewby', viewby)
}

/**
 * Note that this is `false` for sub-routes of `FORM_SETTINGS`.
 * @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern.
 */
export function isFormSettingsRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_SETTINGS.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormMediaRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_MEDIA.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormSharingRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_SHARING.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormRestRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_REST.replace(':uid', uid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormRestHookRoute(uid: string, hookUid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_REST_HOOK.replace(':uid', uid).replace(':hookUid', hookUid)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isFormResetRoute(uid: string): boolean {
  return getCurrentPath() === ROUTES.FORM_RESET.replace(':uid', uid)
}

/*
 * Additional functions
 */

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isAnyFormsRoute(): boolean {
  return getCurrentPath().startsWith(ROUTES.FORMS)
}

/** @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern. */
export function isAnyLibraryRoute(): boolean {
  return getCurrentPath().startsWith(ROUTES.LIBRARY)
}

/**
 * Checks if on any `/library/asset/…` route.
 * @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern.
 */
export function isAnyLibraryItemRoute(): boolean {
  // disregard the `:uid` parameter in url, as we are interested in any asset uid
  return getCurrentPath().startsWith(ROUTES.LIBRARY_ITEM.replace(':uid', ''))
}

/**
 * Checks if on any `/forms/…` route.
 * @deprecated Use React Router's `useLocation` hook instead; see projectTopTabs for the recommended pattern.
 */
export function isAnyFormRoute(): boolean {
  // disregard the `:uid` parameter in url, as we are interested in any asset uid
  return getCurrentPath().startsWith(ROUTES.FORM.replace(':uid', ''))
}

/**
 * Returns asset uid from path if there is any.
 * @deprecated Use React Router's `useParams` hook instead.
 */
export function getRouteAssetUid() {
  if (isAnyFormRoute()) {
    return getCurrentPath().split('/')[2]
  }

  if (isAnyLibraryItemRoute()) {
    return getCurrentPath().split('/')[3]
  }

  return null
}

/**
 * InvalidatedPassword is displayed When user is marked as having invalidated
 * password.
 */
export function isInvalidatedPasswordRouteBlockerActive() {
  return (
    profileStore.isLoggedIn &&
    'validated_password' in profileStore.currentAccount &&
    profileStore.currentAccount.validated_password === false
  )
}

/** TOSAgreement is displayed when user has not accepted latest TOS. */
export function isTOSAgreementRouteBlockerActive() {
  return (
    envStore.data.terms_of_service__sitewidemessage__exists &&
    profileStore.isLoggedIn &&
    // We check for email, because `currentAccount` can be two different things
    'email' in profileStore.currentAccount &&
    profileStore.currentAccount.accepted_tos !== true
  )
}

/**
 * Whether we currently display a route blocker type component. It's one that
 * displays some UI requiring user to take action and blocks any navigation,
 * thus blocking user from using any part of the app. E.g. `TOSAgreement` when
 * user have not accepted the new TOS yet.
 *
 * `ProfileDetails` is deliberately absent: its screen has no account menu to ask this, and the answer needs the
 * organization as well as `/environment` - which is `useProfileDetailsBlockerState`, a hook, not a plain function.
 */
export function isAnyRouteBlockerActive() {
  return isInvalidatedPasswordRouteBlockerActive() || isTOSAgreementRouteBlockerActive()
}
