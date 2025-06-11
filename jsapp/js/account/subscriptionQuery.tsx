import { useQuery } from '@tanstack/react-query'
import { fetchGet } from '#/api'
import { endpoints } from '#/api.endpoints'
import { ACTIVE_STRIPE_STATUSES } from '#/constants'
import type { FailResponse, PaginatedResponse } from '#/dataInterface'
import { QueryKeys } from '#/query/queryKeys'
import type { RecurringInterval, SubscriptionInfo } from './stripe.types'

export interface SubscriptionData {
  plans: SubscriptionInfo[]
  addOns: SubscriptionInfo[]
  activeSubscriptions: SubscriptionInfo[]
  canceledPlans: SubscriptionInfo[]
  billingPeriod: RecurringInterval
}

const getSubscriptionInfo = async (): Promise<SubscriptionData> => {
  const response = await fetchGet<PaginatedResponse<SubscriptionInfo>>(endpoints.SUBSCRIPTION_URL, {
    errorMessageDisplay: t('There was an error fetching the subscription data.'),
  })

  // get all active subscriptions for the user
  const activeSubscriptions = response.results.filter((sub) => ACTIVE_STRIPE_STATUSES.includes(sub.status))
  const canceledPlans = response.results.filter(
    (sub) => sub.items[0]?.price.product.metadata?.product_type === 'plan' && sub.status === 'canceled',
  )
  // get any active plan subscriptions for the user
  const plans = activeSubscriptions.filter((sub) => sub.items[0]?.price.product.metadata?.product_type === 'plan')
  // get any active recurring add-on subscriptions for the user
  const addOns = activeSubscriptions.filter((sub) => sub.items[0]?.price.product.metadata?.product_type === 'addon')

  let billingPeriod: RecurringInterval = 'month'
  if (activeSubscriptions.length > 0) {
    billingPeriod = activeSubscriptions[0].items[0].price.recurring?.interval || 'month'
  }

  return {
    plans,
    addOns,
    activeSubscriptions,
    canceledPlans,
    billingPeriod,
  }
}

/**
 * Custom hook to fetch the subscription information for an organization.
 */
export const useSubscriptionQuery = () => {
  const query = useQuery<SubscriptionData, FailResponse>({
    staleTime: 1000 * 60 * 2,
    queryFn: getSubscriptionInfo,
    queryKey: [QueryKeys.subscriptionQuery],
  })

  return query
}
