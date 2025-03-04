import { createContext, useState } from 'react'

import { getOneTimeAddOns } from '#/account/stripe.api'
import type { OneTimeAddOn } from '#/account/stripe.types'
import useWhenStripeIsEnabled from '#/hooks/useWhenStripeIsEnabled.hook'

export interface OneTimeAddOnState {
  oneTimeAddOns: OneTimeAddOn[]
  isLoaded: boolean
}

const INITIAL_ADDONS_STATE: OneTimeAddOnState = Object.freeze({
  oneTimeAddOns: [],
  isLoaded: false,
})

export function useOneTimeAddOns() {
  const [addons, setAddons] = useState<OneTimeAddOnState>(INITIAL_ADDONS_STATE)

  // get list of addons
  useWhenStripeIsEnabled(() => {
    getOneTimeAddOns().then((oneTimeAddOns) => {
      setAddons(() => {
        return {
          oneTimeAddOns: oneTimeAddOns.results,
          isLoaded: true,
        }
      })
    })
  }, [])

  return addons
}

export const OneTimeAddOnsContext = createContext<OneTimeAddOnState>(INITIAL_ADDONS_STATE)
