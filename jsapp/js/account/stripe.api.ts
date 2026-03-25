import { when } from 'mobx'
import type { AccountLimit, Checkout, OneTimeAddOn, Product } from '#/account/stripe.types'
import { Limits } from '#/account/stripe.types'
import subscriptionStore from '#/account/subscriptionStore'
import { fetchGet, fetchPost } from '#/api'
import { endpoints } from '#/api.endpoints'
import { ACTIVE_STRIPE_STATUSES } from '#/constants'
import type { PaginatedResponse } from '#/dataInterface'
import { recordEntries } from '#/utils'

const DEFAULT_LIMITS: AccountLimit = Object.freeze({
  submission_limit: Limits.unlimited,
  asr_seconds_limit: Limits.unlimited,
  mt_characters_limit: Limits.unlimited,
  storage_bytes_limit: Limits.unlimited,
  llm_requests_limit: Limits.unlimited,
})

export async function getProducts() {
  return fetchGet<PaginatedResponse<Product>>(endpoints.PRODUCTS_URL, {
    errorMessageDisplay: t('There was an error getting the list of plans.'),
  })
}

export async function getOneTimeAddOns() {
  return fetchGet<PaginatedResponse<OneTimeAddOn>>(endpoints.ADD_ONS_URL, {
    errorMessageDisplay: t('There was an error getting one-time add-ons.'),
  })
}

/**
 * Start a checkout session for the given price and organization. Response contains the checkout URL.
 */
export async function postCheckout(priceId: string, organizationId: string) {
  return fetchPost<Checkout>(
    `${endpoints.CHECKOUT_URL}?price_id=${priceId}&organization_id=${organizationId}`,
    {},
    {
      errorMessageDisplay: 'There was an error creating the checkout session. Please try again later.',
    },
  )
}

/**
 * Get the URL of the Stripe customer portal for an organization.
 */
export async function postCustomerPortal(organizationId: string, priceId = '') {
  return fetchPost<Checkout>(
    `${endpoints.PORTAL_URL}?organization_id=${organizationId}&price_id=${priceId}`,
    {},
    {
      errorMessageDisplay: 'There was an error sending you to the billing portal. Please try again later.',
    },
  )
}

/**
 * Extract the limits from Stripe product/price metadata and convert their values from string to number (if necessary.)
 * Will only return limits that exceed the ones in `limitsToCompare`, or all limits if `limitsToCompare` is not present.
 */
function getLimitsForMetadata(metadata: Record<string, string>, limitsToCompare: false | AccountLimit = false) {
  const limits: Partial<AccountLimit> = {}
  for (const [key, value] of recordEntries(metadata)) {
    // if we need to compare limits, make sure we're not overwriting a higher limit from somewhere else
    if (limitsToCompare) {
      if (!(key in limitsToCompare) || value === null) {
        continue
      }
      if (key in limitsToCompare && value !== Limits.unlimited && value <= limitsToCompare[key as keyof AccountLimit]) {
        continue
      }
    }
    // only use metadata needed for limit calculations
    if (key in DEFAULT_LIMITS && value !== null) {
      const numericValue = Number.parseInt(value as string)
      limits[key as keyof AccountLimit] = value === Limits.unlimited ? Limits.unlimited : numericValue
    }
  }
  return limits
}

/**
 * Get limits for any recurring add-ons the user has, merged with the rest of their limits.
 */
const getRecurringAddOnLimits = (limits: AccountLimit) => {
  let newLimits = { ...limits }
  let activeAddOns = [...subscriptionStore.addOnsResponse]
  let metadata: Record<string, string>
  // only check active add-ons
  activeAddOns = activeAddOns.filter((subscription) => ACTIVE_STRIPE_STATUSES.includes(subscription.status))
  activeAddOns.forEach((addOn) => {
    metadata = {
      ...addOn.items[0].price.product.metadata,
      ...addOn.items[0].price.metadata,
    }
    newLimits = { ...newLimits, ...getLimitsForMetadata(metadata, newLimits) }
  })
  return newLimits
}

/**
 * Add one-time addon limits to already calculated account limits
 */
const addRemainingOneTimeAddOnLimits = (limits: AccountLimit, oneTimeAddOns: OneTimeAddOn[]) => {
  // This yields a separate object, so we need to make a copy
  limits = { ...limits }
  oneTimeAddOns
    .filter((addon) => addon.is_available)
    .forEach((addon) => {
      if (addon.limits_remaining.submission_limit && limits.submission_limit !== Limits.unlimited) {
        limits.submission_limit += addon.limits_remaining.submission_limit
      }
      if (addon.limits_remaining.asr_seconds_limit && limits.asr_seconds_limit !== Limits.unlimited) {
        limits.asr_seconds_limit += addon.limits_remaining.asr_seconds_limit
      }
      if (addon.limits_remaining.mt_characters_limit && limits.mt_characters_limit !== Limits.unlimited) {
        limits.mt_characters_limit += addon.limits_remaining.mt_characters_limit
      }
      if (addon.limits_remaining.llm_requests_limit && limits.llm_requests_limit !== Limits.unlimited) {
        limits.llm_requests_limit += addon.limits_remaining.llm_requests_limit
      }
    })
  return limits
}

/**
 * Get all metadata keys for the logged-in user's plan, or from the free tier if they have no plan.
 */
const getStripeMetadataAndFreeTierStatus = async (products: Product[]) => {
  await when(() => subscriptionStore.isInitialised)
  const plans = [...subscriptionStore.planResponse]
  // only use metadata for active subscriptions
  const activeSubscriptions = plans.filter((subscription) => ACTIVE_STRIPE_STATUSES.includes(subscription.status))
  let metadata: Record<string, string>
  let hasFreeTier = false
  if (activeSubscriptions.length) {
    // get metadata from the user's subscription (prioritize price metadata over product metadata)
    metadata = {
      ...activeSubscriptions[0].items[0].price.product.metadata,
      ...activeSubscriptions[0].items[0].price.metadata,
    }
  } else {
    await when(() => !!products.length)
    // the user has no subscription, so get limits from the free monthly product
    hasFreeTier = true
    const freeProduct = products.filter((product) => product.metadata['default_free_plan'] === 'true')[0]
    metadata = {
      ...freeProduct.metadata,
      ...freeProduct.prices[0].metadata,
    }
  }
  return { metadata, hasFreeTier }
}

/**
 * Get the complete account limits for the logged-in user.
 * Checks (in descending order of priority):
 *  - the user's recurring add-ons
 *  - the user's subscription limits
 */
export async function getAccountLimits(products: Product[], oneTimeAddOns: OneTimeAddOn[]) {
  const { metadata, hasFreeTier } = await getStripeMetadataAndFreeTierStatus(products)

  // initialize to unlimited
  let recurringLimits: AccountLimit = { ...DEFAULT_LIMITS }

  // apply any limits from the metadata
  recurringLimits = { ...recurringLimits, ...getLimitsForMetadata(metadata) }

  if (hasFreeTier) {
    // if the user has active recurring add-ons, use those as their limits
    recurringLimits = getRecurringAddOnLimits(recurringLimits)
  }

  // create separate object with one-time addon limits added to the limits calculated so far
  const remainingLimits = addRemainingOneTimeAddOnLimits(recurringLimits, oneTimeAddOns)

  return { recurringLimits, remainingLimits }
}
