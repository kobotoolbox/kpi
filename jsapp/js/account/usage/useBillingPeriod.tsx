import { useQuery } from '@tanstack/react-query'
import { when } from 'mobx'
import { ACTIVE_STRIPE_STATUSES } from '#/constants'
import envStore from '#/envStore'
import { QueryKeys } from '#/query/queryKeys'
import type { RecurringInterval } from '../stripe.types'
import subscriptionStore from '../subscriptionStore'

/**
 * Get the subscription interval (`'month'` or `'year'`) for the logged-in user.
 * Returns `'month'` for users on the free plan.
 */
export async function getSubscriptionInterval() {
  await when(() => envStore.isReady)
  if (envStore.data.stripe_public_key) {
    if (!subscriptionStore.isPending && !subscriptionStore.isInitialised) {
      subscriptionStore.fetchSubscriptionInfo()
    }
    await when(() => subscriptionStore.isInitialised)
    const subscriptionList = subscriptionStore.planResponse
    const activeSubscription = subscriptionList.find((sub) => ACTIVE_STRIPE_STATUSES.includes(sub.status))
    if (activeSubscription) {
      return activeSubscription.items[0].price.recurring?.interval || 'month'
    }
  }
  return 'month'
}

export const useBillingPeriod = (): {
  billingPeriod: RecurringInterval
  isLoading: boolean
} => {
  const { data: billingPeriod, isLoading } = useQuery({
    queryKey: [QueryKeys.billingPeriod],
    queryFn: getSubscriptionInterval,
  })

  return {
    billingPeriod: billingPeriod || 'month',
    // Default to 'month' if billingPeriod is undefined
    // This ensures that the hook always returns a valid billing period
    isLoading,
  }
}
