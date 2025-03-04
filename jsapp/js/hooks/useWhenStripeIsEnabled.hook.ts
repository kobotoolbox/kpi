import useWhen from '#/hooks/useWhen.hook'
import type { DependencyList, EffectCallback } from 'react'
import envStore from '#/envStore'

// A useEffect hook that only executes when Stripe is enabled.
const useWhenStripeIsEnabled = (effect: EffectCallback, dependencies: DependencyList) => {
  useWhen(() => envStore.isReady && envStore.data.stripe_public_key !== null, effect, dependencies)
}

export default useWhenStripeIsEnabled
