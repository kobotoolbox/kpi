import { http, HttpResponse } from 'msw'
import type { SubscriptionInfo } from '#/account/stripe.types'
import { endpoints } from '#/api.endpoints'
import type { PaginatedResponse } from '#/dataInterface'

/**
 * Mock API for stripe subscriptions endpoint.
 * Use it in Storybook tests in `parameters.msw.handlers[]`.
 *
 * Note: NOT migrated to Orval because the detailed Stripe types (SubscriptionInfo)
 * contain more fields than Orval's generated Subscription type. The Stripe SDK types
 * have nested structures for items, prices, products, etc. that would require
 * significant type mapping to work with Orval's simpler schema.
 *
 * @param overrideData - Partial override for the subscription response
 */
const subscriptionMock = (overrideData?: Partial<PaginatedResponse<SubscriptionInfo>>) => {
  const baseResponse = mockSubscriptionResponse()

  return http.get<never, never, PaginatedResponse<SubscriptionInfo>>(endpoints.SUBSCRIPTION_URL, () =>
    HttpResponse.json({ ...baseResponse, ...overrideData }),
  )
}
export default subscriptionMock

const mockSubscriptionResponse = (): PaginatedResponse<SubscriptionInfo> => {
  return {
    count: 1,
    next: null,
    previous: null,
    results: [
      {
        plan: 1,
        djstripe_created: '2025-01-01T00:00:00Z',
        djstripe_updated: '2025-01-01T00:00:00Z',
        id: 'sub_mock123',
        livemode: false,
        created: '2025-01-01T00:00:00Z',
        metadata: {},
        description: 'Mock subscription',
        application_fee_percent: null,
        billing_cycle_anchor: '2025-01-01T00:00:00Z',
        billing_thresholds: null,
        cancel_at: null,
        cancel_at_period_end: false,
        canceled_at: null,
        collection_method: 'charge_automatically',
        current_period_end: '2025-02-01T00:00:00Z',
        current_period_start: '2025-01-01T00:00:00Z',
        days_until_due: null,
        discount: null,
        ended_at: null,
        next_pending_invoice_item_invoice: null,
        pending_invoice_item_interval: null,
        pending_update: null,
        quantity: 1,
        start_date: '2025-01-01T00:00:00Z',
        status: 'active',
        trial_end: null,
        trial_start: null,
        djstripe_owner_account: 'acc_mock123',
        customer: 'cus_mock123',
        default_payment_method: 'pm_mock123',
        default_source: null,
        latest_invoice: 'in_mock123',
        pending_setup_intent: null,
        schedule: {
          phases: null,
          status: 'active',
        },
        default_tax_rates: [],
        items: [
          {
            id: 'si_mock123',
            quantity: 1,
            price: {
              id: 'price_mock123',
              nickname: 'Community Plan Monthly',
              currency: 'usd',
              type: 'recurring',
              unit_amount: 0,
              human_readable_price: '$0',
              active: true,
              recurring: {
                interval: 'month' as const,
                aggregate_usage: 'sum',
                interval_count: 1,
                usage_type: 'licensed' as const,
              },
              metadata: {},
              transform_quantity: null,
              product: {
                id: 'prod_mock123',
                name: 'Community Plan',
                description: 'Community plan for small teams',
                type: 'service',
                metadata: {
                  product_type: 'plan',
                },
              },
            },
          },
        ],
      },
    ],
  }
}
