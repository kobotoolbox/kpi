import {createContext, useState} from 'react';
import type {
  OneTimeAddOn,
} from 'js/account/stripe.types';
import useWhenStripeIsEnabled from 'js/hooks/useWhenStripeIsEnabled.hook';
import {getOneTimeAddOns} from 'js/account/stripe.api';

export interface OneTimeAddOnState {
  addons: OneTimeAddOn[];
  isLoaded: boolean;
}

const INITIAL_ADDONS_STATE: OneTimeAddOnState = Object.freeze({
  addons: [],
  isLoaded: false,
});

export function useOneTimeAddOns() {
  const [addons, setAddons] = useState<OneTimeAddOnState>(INITIAL_ADDONS_STATE);

  // get list of products
  useWhenStripeIsEnabled(() => {
    getOneTimeAddOns().then((addons) => {
      setAddons(() => {
        return {
          addons: addons.results,
          isLoaded: true,
        };
      });
    });
  }, []);

  return addons;
}

export const OneTimeAddOnsContext =
  createContext<OneTimeAddOnState>(INITIAL_ADDONS_STATE);
