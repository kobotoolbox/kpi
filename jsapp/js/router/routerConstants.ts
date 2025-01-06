// List of server routes
export const PATHS = Object.freeze({
  LOGIN: '/accounts/login',
  RESET: '/accounts/password/reset/',
  MS_SSO: '/accounts/microsoft/login/',
});

// List of React app routes (the # ones)
export const ROUTES = Object.freeze({
  ROOT: '',
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
});

export const PROJECTS_ROUTES: {readonly [key: string]: string} = {
  MY_PROJECTS: ROUTES.PROJECTS_ROOT + '/home',
  /**
   * We break from the default way to set routes here, as we want to be
   * consistent with other organization related routes.
   */
  MY_ORG_PROJECTS: '/organization/projects',
  CUSTOM_VIEW: ROUTES.PROJECTS_ROOT + '/:viewUid',
};

export const PROCESSING_ROUTE_GENERIC = ROUTES.FORM_PROCESSING_ROOT + '/:tabName';
export const PROCESSING_ROUTES: {readonly [key: string]: string} = {
  TRANSCRIPT: PROCESSING_ROUTE_GENERIC.replace(':tabName', 'transcript'),
  TRANSLATIONS: PROCESSING_ROUTE_GENERIC.replace(':tabName', 'translations'),
  ANALYSIS: PROCESSING_ROUTE_GENERIC.replace(':tabName', 'analysis'),
};
