import BillingButton from '#/account/plans/billingButton.component'
import { postCustomerPortal } from '#/account/stripe.api'
import type { Price, SinglePricedProduct } from '#/account/stripe.types'
import { processCheckoutResponse } from '#/account/stripe.utils'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'

interface PlanButtonProps {
  buySubscription: (price: Price) => void
  downgrading: boolean
  isBusy: boolean
  isSubscribedToPlan: boolean
  showManage: boolean
  product: SinglePricedProduct
  setIsBusy: (value: boolean) => void
}

/**
 * A button that's used to start checkout for a Plan at Stripe.
 * Plans need extra logic that add-ons don't, mostly to display the correct label text.
 */
export const PlanButton = ({
  product,
  downgrading,
  isBusy,
  setIsBusy,
  buySubscription,
  showManage,
  isSubscribedToPlan,
}: PlanButtonProps) => {
  const [organization] = useOrganizationAssumed()

  if (!product || product.price.unit_amount === 0) {
    return null
  }

  const manageSubscription = (subscriptionPrice?: Price) => {
    setIsBusy(true)
    postCustomerPortal(organization.id, subscriptionPrice?.id)
      .then(processCheckoutResponse)
      .catch(() => setIsBusy(false))
  }

  if (!isSubscribedToPlan && !showManage && !downgrading) {
    return (
      <BillingButton
        label={t('Upgrade')}
        onClick={() => buySubscription(product.price)}
        aria-label={`upgrade to ${product.name}`}
        isDisabled={isBusy}
      />
    )
  }

  if (showManage || isSubscribedToPlan) {
    return (
      <BillingButton
        label={t('Manage')}
        onClick={manageSubscription}
        aria-label={`manage your ${product.name} subscription`}
        isDisabled={isBusy}
      />
    )
  }

  return (
    <BillingButton
      label={t('Change plan')}
      onClick={() => buySubscription(product.price)}
      aria-label={`change your subscription to ${product.name}`}
      isDisabled={isBusy}
    />
  )
}
