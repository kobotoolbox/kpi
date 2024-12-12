export const endpoints = {
  ASSET_HISTORY: '/api/v2/assets/:asset_uid/history/',
  ASSET_URL: '/api/v2/assets/:uid/',
  ORG_ASSETS_URL: '/api/v2/organizations/:organization_id/assets/',
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
} as const;
