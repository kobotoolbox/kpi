export const endpoints = {
  PRODUCTS_URL: '/api/v2/stripe/products/',
  SUBSCRIPTION_URL: '/api/v2/stripe/subscriptions/',
  ORGANIZATION_URL: '/api/v2/organizations/',
  CHECKOUT_URL: /** Expected parameters: price_id and organization_uid **/
    '/api/v2/stripe/checkout-link',
  PORTAL_URL: /** Expected parameter: organization_uid  **/
    '/api/v2/stripe/customer-portal',
};
