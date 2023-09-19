export const endpoints = {
  ME_URL: '/me/',
  PRODUCTS_URL: '/api/v2/stripe/products/',
  SUBSCRIPTION_URL: '/api/v2/stripe/subscriptions/',
  ORGANIZATION_URL: '/api/v2/organizations/',
  /** Expected parameters: price_id and organization_uid **/
  CHECKOUT_URL: '/api/v2/stripe/checkout-link',
  /** Expected parameter: organization_uid  **/
  PORTAL_URL: '/api/v2/stripe/customer-portal',
  USERS_USER_URL: '/api/v2/users/<username>/',
};
