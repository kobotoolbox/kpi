export const endpoints = {
  PRODUCTS_URL: '/api/v2/stripe/products/',
  SUBSCRIPTION_URL: '/api/v2/stripe/subscriptions/',
  ORGANIZATION_URL: '/api/v2/organizations/',
  CHECKOUT_URL: '/api/v2/stripe/checkout-link', /** Expected parameters: price_id and organization_uid **/
  PORTAL_URL: '/api/v2/stripe/customer-portal', /** Expected parameter: organization_uid  **/
};
