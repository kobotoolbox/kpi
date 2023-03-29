import {fetchGet, fetchPost} from 'jsapp/js/api';
import type {PaginatedResponse} from 'js/dataInterface';

export interface BaseProduct {
  id: string;
  name: string;
  description: string;
  type: string;
  metadata: {[key: string]: string};
}

export interface BasePrice {
  id: string;
  nickname: string;
  currency: string;
  type: string;
  unit_amount: number;
  human_readable_price: string;
  metadata: {[key: string]: string};
}

export interface BaseSubscription {
  id: number;
  price: Product;
}

export interface Organization {
  uid: string;
  name: string;
  is_active: boolean;
  created: string;
  modified: string;
  slug: string;
}

export interface Product extends BaseProduct {
  prices: Array<BasePrice>;
}

export interface Price extends BaseProduct {
  prices: BasePrice;
}

export interface Checkout {
  url: string;
}

export interface Portal {
  url: string;
}

const PRODUCTS_URL = '/api/v2/stripe/products/';
const SUBSCRIPTION_URL = '/api/v2/stripe/subscriptions/';
const ORGANIZATION_URL = '/api/v2/organizations/';
const CHECKOUT_URL = '/api/v2/stripe/checkout-link';
const PORTAL_URL = '/api/v2/stripe/customer-portal';

export async function getProducts() {
  return fetchGet<PaginatedResponse<Product>>(PRODUCTS_URL);
}

export async function getSubscription() {
  return fetchGet<PaginatedResponse<BaseSubscription>>(SUBSCRIPTION_URL);
}

export async function getOrganization() {
  return fetchGet<PaginatedResponse<Organization>>(ORGANIZATION_URL);
}

export async function postCheckout(priceId: string, organizationId: string) {
  return fetchPost<Checkout>(
    `${CHECKOUT_URL}?price_id=${priceId}&organization_uid=${organizationId}`,
    {}
  );
}

export async function postCustomerPortal(organizationId: string) {
  return fetchPost<Portal>(
    `${PORTAL_URL}?organization_uid=${organizationId}`,
    {}
  );
}
