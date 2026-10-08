// List of server routes
export const PATHS = Object.freeze({
  LOGIN: '/accounts/login',
  RESET: '/accounts/password/reset/',
  MS_SSO: '/accounts/microsoft/login/',
  /** allauth's own one-time code prompt. Redirects to `LOGIN` when no verification is pending. */
  MFA_AUTHENTICATE: '/accounts/2fa/authenticate/',
})

// List of React app routes (the # ones)
export const ROUTES = Object.freeze({
  ROOT: '',
  /** Kept distinct from the server's own `/accounts/` prefix, so a URL says which side it means. */
  AUTH_ROOT: '/auth',
  ACCOUNT_ROOT: '/account',
  ORGANIZATION: '/account/organization',
  LIBRARY: '/library',
  MY_LIBRARY: '/library/my-library',
  PUBLIC_COLLECTIONS: '/library/public-collections',
  NEW_LIBRARY_ITEM: '/library/asset/new',
  LIBRARY_ITEM: '/library/asset/:uid',
  EDIT_LIBRARY_ITEM: '/library/asset/:uid/edit',
  NEW_LIBRARY_CHILD: '/library/asset/:uid/new',
  LIBRARY_ITEM_JSON: '/library/asset/:uid/json',
  LIBRARY_ITEM_XFORM: '/library/asset/:uid/xform',
  PROJECTS_ROOT: '/projects',
  FORMS: '/forms',
  FORM: '/forms/:uid',
  FORM_JSON: '/forms/:uid/json',
  FORM_XFORM: '/forms/:uid/xform',
  FORM_EDIT: '/forms/:uid/edit',
  FORM_SUMMARY: '/forms/:uid/summary',
  FORM_LANDING: '/forms/:uid/landing',
  FORM_DATA: '/forms/:uid/data',
  FORM_REPORT: '/forms/:uid/data/report',
  /** Has: :uid */
  FORM_TABLE: '/forms/:uid/data/table',
  FORM_DOWNLOADS: '/forms/:uid/data/downloads',
  FORM_GALLERY: '/forms/:uid/data/gallery',
  FORM_MAP: '/forms/:uid/data/map',
  FORM_MAP_BY: '/forms/:uid/data/map/:viewby',
  /** Has: :uid, :xpath, :submissionEditId */
  FORM_PROCESSING_ROOT: '/forms/:uid/data/processing/:xpath/:submissionEditId',
  FORM_SETTINGS: '/forms/:uid/settings',
  FORM_ACTIVITY: '/forms/:uid/settings/activity',
  FORM_MEDIA: '/forms/:uid/settings/media',
  FORM_SHARING: '/forms/:uid/settings/sharing',
  FORM_RECORDS: '/forms/:uid/settings/records',
  FORM_REST: '/forms/:uid/settings/rest',
  FORM_REST_HOOK: '/forms/:uid/settings/rest/:hookUid',
  FORM_RESET: '/forms/:uid/reset',
})

/** The screens you reach without a session. Leaf paths keep allauth's own names, under our `/auth` prefix. */
export const AUTH_ROUTES: { readonly [key: string]: string } = {
  /** The redesigned sign-in screen. `PATHS.LOGIN` is the Django one it will eventually replace. */
  LOGIN: ROUTES.AUTH_ROOT + '/login',
  SIGNUP: ROUTES.AUTH_ROOT + '/signup',
  /**
   * Named after allauth's `account_confirm_email`, where the sign up email's link points. That link goes to
   * the server rendered page, not here - aiming it at this screen is DEV-1860.
   */
  CONFIRM_EMAIL: ROUTES.AUTH_ROOT + '/confirm-email/:key',
  /** Asks for an address to mail a password reset link to */
  RESET_PASSWORD: ROUTES.AUTH_ROOT + '/password/reset',
  /** Where the link in the password reset email lands, to pick the new password */
  NEW_PASSWORD: ROUTES.AUTH_ROOT + '/password/reset/key/:key',
  /** One-time code prompt, for a sign-in allauth paused after the password */
  MFA_AUTHENTICATE: ROUTES.AUTH_ROOT + '/authenticate/totp',
  /** The same prompt, answered with a recovery code */
  MFA_RECOVERY_CODES: ROUTES.AUTH_ROOT + '/authenticate/recovery-codes',
  /** Where an SSO sign-in lands when allauth still needs a username or an address */
  PROVIDER_SIGNUP: ROUTES.AUTH_ROOT + '/provider/signup',
}

/**
 * The authentication screens that need a session.
 *
 * Unlike {@link AUTH_ROUTES} these sit inside `<App />`, next to the rest of `/account/…`.
 * Kept apart from `ACCOUNT_ROUTES`, which is profile and billing settings and isn't behind a flag.
 */
export const ACCOUNT_AUTH_ROUTES: { readonly [key: string]: string } = {
  EMAIL: ROUTES.ACCOUNT_ROOT + '/email',
  /** TODO: Duplicates the live `ACCOUNT_ROUTES.CHANGE_PASSWORD`; this allauth path takes over ultimately. */
  CHANGE_PASSWORD: ROUTES.ACCOUNT_ROOT + '/password/change',
  PROVIDERS: ROUTES.ACCOUNT_ROOT + '/providers',
  /** Every browser signed in to this account */
  SESSIONS: ROUTES.ACCOUNT_ROOT + '/sessions',
  MFA: ROUTES.ACCOUNT_ROOT + '/2fa',
  MFA_TOTP_ACTIVATE: ROUTES.ACCOUNT_ROOT + '/2fa/totp/activate',
  MFA_TOTP_DEACTIVATE: ROUTES.ACCOUNT_ROOT + '/2fa/totp/deactivate',
  MFA_RECOVERY_CODES: ROUTES.ACCOUNT_ROOT + '/2fa/recovery-codes',
  MFA_RECOVERY_CODES_GENERATE: ROUTES.ACCOUNT_ROOT + '/2fa/recovery-codes/generate',
  /** allauth asks for the password again before a sensitive change. The two below are for when it isn't enough. */
  REAUTHENTICATE: ROUTES.ACCOUNT_ROOT + '/reauthenticate',
  REAUTHENTICATE_TOTP: ROUTES.ACCOUNT_ROOT + '/reauthenticate/totp',
  REAUTHENTICATE_RECOVERY_CODES: ROUTES.ACCOUNT_ROOT + '/reauthenticate/recovery-codes',
}

export const PROJECTS_ROUTES: { readonly [key: string]: string } = {
  MY_PROJECTS: ROUTES.PROJECTS_ROOT + '/home',
  /**
   * We break from the default way to set routes here, as we want to be
   * consistent with other organization related routes.
   */
  MY_ORG_PROJECTS: '/organization/projects',
  CUSTOM_VIEW: ROUTES.PROJECTS_ROOT + '/:viewUid',
}

export const PROCESSING_ROUTE_GENERIC = ROUTES.FORM_PROCESSING_ROOT + '/:tabName'
export const PROCESSING_ROUTES: { readonly [key: string]: string } = {
  TRANSCRIPT: PROCESSING_ROUTE_GENERIC.replace(':tabName', 'transcript'),
  TRANSLATIONS: PROCESSING_ROUTE_GENERIC.replace(':tabName', 'translations'),
  TRANSLATION_DETAIL: PROCESSING_ROUTE_GENERIC.replace(':tabName', 'translations') + '/:languageCode',
  ANALYSIS: PROCESSING_ROUTE_GENERIC.replace(':tabName', 'analysis'),
}
