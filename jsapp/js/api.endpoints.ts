export const endpoints = {
  ASSET_URL: '/api/v2/assets/:uid/',
  ME_URL: '/me/',
  PRODUCTS_URL: '/api/v2/stripe/products/',
  SUBSCRIPTION_URL: '/api/v2/stripe/subscriptions/',
  ORGANIZATION_URL: '/api/v2/organizations/',
  /** Expected parameters: price_id and organization_id **/
  CHECKOUT_URL: '/api/v2/stripe/checkout-link',
  /** Expected parameter: organization_id  **/
  PORTAL_URL: '/api/v2/stripe/customer-portal',
  /** Expected parameters: price_id and subscription_id **/
  CHANGE_PLAN_URL: '/api/v2/stripe/change-plan',
};
