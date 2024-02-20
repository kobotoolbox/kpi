import {createContext, useEffect, useState} from 'react';
import type {Product} from 'js/account/stripe.types';
import {getProducts} from 'js/account/stripe.api';
import useWhenStripeIsEnabled from 'js/hooks/useWhenStripeIsEnabled.hook';

export interface ProductsState {
  products: Product[];
  isLoaded: boolean;
}

const INITIAL_PRODUCTS_STATE: ProductsState = Object.freeze({
  products: [],
  isLoaded: false,
});

export function useProducts() {
  const [products, setProducts] = useState<ProductsState>(
    INITIAL_PRODUCTS_STATE
  );

  // get list of products
  useWhenStripeIsEnabled(() => {
    getProducts().then((products) => {
      setProducts(() => {
        return {
          products: products.results,
          isLoaded: true,
        };
      });
    });
  }, []);

  return products;
}

export const ProductsContext = createContext<ProductsState>(
  INITIAL_PRODUCTS_STATE
);
