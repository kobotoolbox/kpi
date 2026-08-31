import { useQuery } from '@tanstack/react-query'
import { when } from 'mobx'
import { ACTIVE_STRIPE_STATUSES } from '#/constants'
import envStore from '#/envStore'
import { QueryKeys } from '#/query/queryKeys'
import type { RecurringInterval } from '../stripe.types'
import subscriptionStore from '../subscriptionStore'

/**
 * Get the subscription interval (`'month'` or `'year'`) for the logged-in user, along with whether
 * they have an active plan at all.
 *
 * Returns `{interval: 'month', hasActivePlan: false}` for users on the free plan (and on deployments
 * without Stripe). This is so we can give a more accurate 'billing period' description for users that
 * have active monthly plans.
 */
export async function getSubscriptionInfo(): Promise<{
  interval: RecurringInterval
  hasActivePlan: boolean
}> {
  await when(() => envStore.isReady)
  if (envStore.data.stripe_public_key) {
    if (!subscriptionStore.isPending && !subscriptionStore.isInitialised) {
      subscriptionStore.fetchSubscriptionInfo()
    }
    await when(() => subscriptionStore.isInitialised)
    const subscriptionList = subscriptionStore.planResponse
    const activeSubscription = subscriptionList.find((sub) => ACTIVE_STRIPE_STATUSES.includes(sub.status))
    if (activeSubscription) {
      return {
        interval: activeSubscription.items[0].price.recurring?.interval || 'month',
        hasActivePlan: true,
      }
    }
  }
  return { interval: 'month', hasActivePlan: false }
}

export const useBillingPeriod = (): {
  billingPeriod: RecurringInterval
  hasActivePlan: boolean
  isLoading: boolean
} => {
  const { data, isLoading } = useQuery({
    queryKey: [QueryKeys.billingPeriod],
    queryFn: getSubscriptionInfo,
  })

  return {
    // Default to 'month'/no plan while the query is still loading.
    // This ensures that the hook always returns a valid billing period
    billingPeriod: data?.interval || 'month',
    hasActivePlan: data?.hasActivePlan ?? false,
    isLoading,
  }
}
