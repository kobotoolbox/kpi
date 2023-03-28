import {fetchGet} from 'jsapp/js/api';
import type {PaginatedResponse} from 'js/dataInterface';

export interface BaseProduct {
  id: string;
  name: string;
  description: string;
  type: string;
  metadata: unknown;
}

export interface BasePrice {
    id: string;
    nickname: string;
    currency: string;
    type: string;
    unit_amount: number;
    human_readable_price: string;
    metadata: unknown;
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

const PRODUCTS_URL = '/api/v2/stripe/products/';
const SUBSCRIPTION_URL = '/api/v2/stripe/subscriptions/';
const ORGANIZATION_URL = '/api/v2/organizations/';

export async function getProducts() {
  return fetchGet<PaginatedResponse<Product>>(PRODUCTS_URL);
}

export async function getSubscription(){
  return fetchGet<PaginatedResponse<BaseSubscription>>(SUBSCRIPTION_URL);
}

export async function getOrganization(){
  return fetchGet<PaginatedResponse<Organization>>(ORGANIZATION_URL);
}
