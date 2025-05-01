export const endpoints = {
  ENVIRONMENT: '/environment/',
  /** Note: currently this endpoint only handles DELETE */
  ATTACHMENT_BULK_URL: '/api/v2/asset/:asset_uid/attachments/bulk',
  /** Note: currently this endpoint only handles DELETE */
  ATTACHMENT_DETAIL_URL: '/api/v2/asset/:asset_uid/data/:submission_id/attachments/:attachment_uid/',
  /** Note: currently this endpoint only handles DELETE */
  ATTACHMENT_DETAIL_BULK_URL: '/api/v2/asset/:asset_uid/data/:submission_id/attachments/:attachment_uid/bulk',
  /** Note: currently this endpoint only handles DELETE */
  ATTACHMENTS_URL: '/api/v2/asset/:asset_uid/data/:submission_id/attachments/',
  ASSET_HISTORY: '/api/v2/assets/:asset_uid/history/',
  ASSET_HISTORY_ACTIONS: '/api/v2/assets/:asset_uid/history/actions',
  ASSET_HISTORY_EXPORT: '/api/v2/assets/:asset_uid/history/export/',
  ASSET_URL: '/api/v2/assets/:uid/',
  ORG_ASSETS_URL: '/api/v2/organizations/:organization_id/assets/',
  ORG_MEMBER_INVITES_URL: '/api/v2/organizations/:organization_id/invites/',
  ORG_MEMBER_INVITE_DETAIL_URL: '/api/v2/organizations/:organization_id/invites/:invite_id/',
  ME_URL: '/me/',
  PRODUCTS_URL: '/api/v2/stripe/products/',
  SUBSCRIPTION_URL: '/api/v2/stripe/subscriptions/',
  ADD_ONS_URL: '/api/v2/stripe/addons/',
  ORGANIZATION_MEMBERS_URL: '/api/v2/organizations/:organization_id/members/',
  ORGANIZATION_MEMBER_URL: '/api/v2/organizations/:organization_id/members/:username/',
  /** Expected parameters: price_id and organization_id **/
  CHECKOUT_URL: '/api/v2/stripe/checkout-link',
  /** Expected parameter: organization_id  **/
  PORTAL_URL: '/api/v2/stripe/customer-portal',
  PROJECT_HISTORY_LOGS: '/api/v2/project-history-logs/',
  /** Expected parameters: price_id and subscription_id **/
  CHANGE_PLAN_URL: '/api/v2/stripe/change-plan',
  ACCESS_LOGS_URL: '/api/v2/access-logs/me',
  ACCESS_LOGS_EXPORT_URL: '/api/v2/access-logs/me/export/',
  LOGOUT_ALL: '/logout-all/',
  LANGUAGES_LIST_URL: '/api/v2/languages/',
  LANGUAGE_DETAIL_URL: '/api/v2/languages/:language_id/',
} as const
