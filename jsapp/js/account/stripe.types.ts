interface SubscriptionPhase {
  items: [
    {
      plan: string
      price: string
      metadata: Record<string, string>
      quantity: number
      tax_rates: [number]
      billing_thresholds: Record<string, string>
    },
  ]
  coupon: null
  currency: string
  end_date: number | null
  metadata: {}
  trial_end: number | null
  start_date: number | null
  description: string | null
  on_behalf_of: string | null
  automatic_tax: {
    enabled: boolean
  }
  transfer_data: string | null
  invoice_settings: string | null
  add_invoice_items: []
  collection_method: string | null
  default_tax_rates: []
  billing_thresholds: null
  proration_behavior: string
  billing_cycle_anchor: number | null
  default_payment_method: string | null
  application_fee_percent: number | null
}

interface SubscriptionSchedule {
  phases: SubscriptionPhase[] | null
  status: 'not_started' | 'active' | 'completed' | 'released' | 'canceled'
}

export interface SubscriptionInfo {
  plan: number
  djstripe_created: string
  djstripe_updated: string
  id: string
  livemode: boolean
  created: string
  metadata: {}
  description: string
  application_fee_percent: any
  billing_cycle_anchor: string
  billing_thresholds: any
  cancel_at: string | null
  cancel_at_period_end: boolean
  canceled_at: any
  collection_method: string
  current_period_end: string
  current_period_start: string
  days_until_due: any
  discount: any
  ended_at: any
  next_pending_invoice_item_invoice: any
  pending_invoice_item_interval: any
  pending_update: any
  quantity: number
  start_date: string
  status: string
  trial_end: any
  trial_start: any
  djstripe_owner_account: string
  customer: string
  default_payment_method: string
  default_source: any
  latest_invoice: string
  pending_setup_intent: any
  schedule: SubscriptionSchedule
  default_tax_rates: []
  items: SubscriptionItem[]
}

export interface SubscriptionItem {
  id: string
  price: PriceWithProduct
  quantity: number
}

// There is probably a better way to hand the nested types
export interface Product extends BaseProduct {
  prices: Price[]
}

// This is a frontend-only interface for accessing the relevant price of a product
export interface SinglePricedProduct extends BaseProduct {
  price: Price
}

export interface BaseProduct {
  id: string
  name: string
  description: string
  type: string
  metadata: Record<string, string>
}

export type RecurringInterval = 'year' | 'month'

export interface Price {
  id: string
  nickname: string
  currency: string
  type: string
  unit_amount: number
  human_readable_price: string
  active: boolean
  recurring?: {
    interval: RecurringInterval
    aggregate_usage: string
    interval_count: number
    usage_type: 'metered' | 'licensed'
  }
  metadata: { [key: string]: string }
  product: string
  transform_quantity: null | TransformQuantity
}

export interface PriceWithProduct extends Omit<Price, 'product'> {
  product: BaseProduct
}

export interface TransformQuantity {
  divide_by: number
  round: 'up' | 'down'
}

export enum PlanNames {
  FREE = 'Community',
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  COMMUNITY = 'Community',
  PRO = 'Professional',
  ENTERPRISE = 'Enterprise',
}

export enum UsageLimitTypes {
  STORAGE = 'storage',
  SUBMISSION = 'submission',
  TRANSCRIPTION = 'automated transcription',
  TRANSLATION = 'machine translation',
  LLM_REQUEST = 'AI analysis',
}

export enum Limits {
  unlimited = 'unlimited',
}

export type LimitAmount = number | 'unlimited'

export interface AccountLimit {
  submission_limit: LimitAmount
  asr_seconds_limit: LimitAmount
  mt_characters_limit: LimitAmount
  storage_bytes_limit: LimitAmount
  llm_requests_limit: LimitAmount
}

export interface AccountLimitDetail {
  recurringLimits: AccountLimit
  remainingLimits: AccountLimit
}

export interface Checkout {
  url: string
}

export enum SubscriptionChangeType {
  CANCELLATION = 0,
  RENEWAL = 1,
  PRODUCT_CHANGE = 2,
  PRICE_CHANGE = 3,
  NO_CHANGE = 5,
}

export interface OneTimeAddOn {
  id: string
  created: string
  is_available: boolean
  usage_limits: Partial<OneTimeUsageLimits>
  total_usage_limits: Partial<OneTimeUsageLimits>
  limits_remaining: Partial<OneTimeUsageLimits>
  organization: string
  product: string
}

export interface OneTimeUsageLimits {
  submission_limit: number
  asr_seconds_limit: number
  mt_characters_limit: number
  llm_requests_limit: number
}

export enum USAGE_TYPE {
  SUBMISSIONS = 0,
  TRANSCRIPTION = 1,
  TRANSLATION = 2,
  STORAGE = 3,
  LLM = 4,
}
