import type { PaginatedSubscriptionList } from '#/api/models/paginatedSubscriptionList'
import { useStripeSubscriptionsList } from '#/api/react-query/stripe'
import { ACTIVE_STRIPE_STATUSES } from '#/constants'

export const getBillingPeriod = (subscriptionList: PaginatedSubscriptionList) => {
  const activeSubscription = subscriptionList.results
    .filter((sub) => sub.items[0]?.price.product.metadata.product_type === 'plan')
    .find((sub) => ACTIVE_STRIPE_STATUSES.includes(sub.status))

  return activeSubscription?.items[0].price.recurring?.interval || 'month'
}

/**
 * WIP
 */
export const useBillingPeriod = () => {
  const queryResult = useStripeSubscriptionsList()

  const billingPeriod = queryResult.data?.status == 200 ? getBillingPeriod(queryResult.data.data) : undefined

  return {
    ...queryResult,
    billingPeriod,
  }
}
