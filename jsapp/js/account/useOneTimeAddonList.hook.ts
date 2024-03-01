import {createContext, useEffect, useState} from 'react';
import type {OneTimeAddOn} from 'js/account/stripe.types';
import {getProducts} from 'js/account/stripe.api';
import useWhenStripeIsEnabled from 'js/hooks/useWhenStripeIsEnabled.hook';

export interface OneTimeAddOnState {
  addons: OneTimeAddOn[];
  isLoaded: boolean;
}

const INITIAL_ADDONS_STATE: OneTimeAddOnState = Object.freeze({
  addons: [],
  isLoaded: false,
});

export function useProducts() {
  const [addons, setAddons] = useState<OneTimeAddOnState>(INITIAL_ADDONS_STATE);

  // get list of products
  useWhenStripeIsEnabled(() => {
    getOneTimeAddOns().then((products) => {
      setAddons(() => {
        return {
          addons: products.results,
          isLoaded: true,
        };
      });
    });
  }, []);

  return addons;
}

export const ProductsContext =
  createContext<ProductsState>(INITIAL_ADDONS_STATE);
