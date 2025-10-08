import React, { useCallback, useMemo } from 'react'

import classnames from 'classnames'
import type { FreeTierOverride, PlanState } from '#/account/plans/plan.component'
import styles from '#/account/plans/plan.module.scss'
import { PlanButton } from '#/account/plans/planButton.component'
import { useDisplayPrice } from '#/account/plans/useDisplayPrice.hook'
import type { Price, SinglePricedProduct, SubscriptionInfo } from '#/account/stripe.types'
import { getSubscriptionsForProductId, isChangeScheduled, isDowngrade } from '#/account/stripe.utils'
import Icon from '#/components/common/icon'
import { recordKeys } from '#/utils'

interface PlanContainerProps {
  product: SinglePricedProduct
  isDisabled: boolean
  isSubscribedProduct: (product: SinglePricedProduct) => boolean
  freeTierOverride: FreeTierOverride | null
  expandComparison: boolean
  state: PlanState
  filteredPriceProducts: SinglePricedProduct[]
  setIsBusy: (isBusy: boolean) => void
  hasManageableStatus: (sub: SubscriptionInfo) => boolean
  buySubscription: (price: Price) => void
  activeSubscriptions: SubscriptionInfo[]
}

export const PlanContainer = ({
  product,
  state,
  freeTierOverride,
  expandComparison,
  filteredPriceProducts,
  isDisabled,
  setIsBusy,
  hasManageableStatus,
  isSubscribedProduct,
  buySubscription,
  activeSubscriptions,
}: PlanContainerProps) => {
  // display price for the plan/price we're currently displaying
  const displayPrice = useDisplayPrice(product.price)
  const shouldShowManage = useCallback(
    (product: SinglePricedProduct) => {
      const subscriptions = getSubscriptionsForProductId(product.id, state.subscribedProduct)
      if (!subscriptions || !subscriptions.length) {
        return false
      }

      const activeSubscription = subscriptions.find((subscription: SubscriptionInfo) =>
        hasManageableStatus(subscription),
      )
      if (!activeSubscription) {
        return false
      }

      return isChangeScheduled(product.price, [activeSubscription])
    },
    [hasManageableStatus, state.subscribedProduct],
  )

  const isDowngrading = useMemo(() => isDowngrade(activeSubscriptions, product.price), [activeSubscriptions, product])

  const getFeatureMetadata = (product: SinglePricedProduct, featureItem: string) => {
    if (product.price.unit_amount === 0 && freeTierOverride && freeTierOverride.hasOwnProperty(featureItem)) {
      return freeTierOverride[featureItem as keyof FreeTierOverride]
    }
    return product.price.metadata?.[featureItem] || product.metadata[featureItem]
  }

  const renderFeaturesList = (
    items: Array<{
      icon: 'positive' | 'positive_pro' | 'negative'
      label: string
    }>,
    title?: string,
  ) => (
    <div key={title}>
      <h2 className={styles.listTitle}>{title} </h2>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <div className={styles.iconContainer}>
              {item.icon !== 'negative' ? (
                <Icon name='check' size='m' color={item.icon === 'positive_pro' ? 'teal' : 'storm'} />
              ) : (
                <Icon name='close' size='m' color='mid-red' />
              )}
            </div>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  )

  // Get feature items and matching icon boolean
  const getListItem = (listType: string, plan: string) => {
    const listItems: Array<{ icon: boolean; item: string }> = []
    filteredPriceProducts.map((product) =>
      recordKeys(product.metadata).map((featureItem) => {
        const numberItem = featureItem.lastIndexOf('_')
        const currentResult = featureItem.substring(numberItem + 1)

        const currentIcon = `feature_${listType}_check_${currentResult}`
        if (
          featureItem.includes(`feature_${listType}_`) &&
          !featureItem.includes(`feature_${listType}_check`) &&
          product.name === plan
        ) {
          const keyName = `feature_${listType}_${currentResult}`
          let iconBool = false
          const itemName: string = product.price.metadata?.[keyName] || product.metadata[keyName]
          if (product.metadata?.[currentIcon] !== undefined) {
            iconBool = JSON.parse(product.metadata[currentIcon])
            listItems.push({ icon: iconBool, item: itemName })
          }
        }
      }),
    )
    return listItems
  }

  const returnListItem = (type: string, name: string, featureTitle: string) => {
    const items: Array<{
      icon: 'positive' | 'positive_pro' | 'negative'
      label: string
    }> = []
    getListItem(type, name).map((listItem) => {
      if (listItem.icon && (name === 'Professional' || name === 'Teams')) {
        items.push({ icon: 'positive_pro', label: listItem.item })
      } else if (listItem.icon) {
        items.push({ icon: 'positive', label: listItem.item })
      } else {
        items.push({ icon: 'negative', label: listItem.item })
      }
    })
    return renderFeaturesList(items, featureTitle)
  }

  const asrMinutes =
    Number.parseInt(product.metadata?.asr_seconds_limit || '0') ||
    Number.parseInt(product.price.metadata?.asr_seconds_limit || '0')

  const mtCharacters =
    Number.parseInt(product.metadata?.mt_characters_limit || '0') ||
    Number.parseInt(product.price.metadata?.mt_characters_limit || '0')

  return (
    <>
      {isSubscribedProduct(product) ? (
        <div className={styles.currentPlan}>{t('Your plan')}</div>
      ) : null}
      <div
        className={classnames({
          [styles.planContainerWithBadge]: isSubscribedProduct(product),
          [styles.planContainer]: true,
        })}
      >
        <div className={styles.planDetailsContainer}>
          <h1 className={styles.priceName}>
            {product.price?.unit_amount ? product.name : freeTierOverride?.name || product.name}
          </h1>
          <div className={styles.priceTitle}>{displayPrice}</div>
          <ul className={styles.featureContainer}>
            {recordKeys(product.metadata).map(
              (featureItem: string) =>
                featureItem.includes('feature_list_') && (
                  <li key={featureItem + product.id}>
                    <div className={styles.iconContainer}>
                      <Icon name='check' size='m' color={product.price.unit_amount ? 'teal' : 'storm'} />
                    </div>
                    {getFeatureMetadata(product, featureItem)}
                  </li>
                ),
            )}
          </ul>
          {expandComparison && (
            <div className={styles.expandedContainer}>
              <hr />
              {state.featureTypes.map((type, index, array) => {
                const featureItem = getListItem(type, product.name)
                return (
                  featureItem.length > 0 && [
                    returnListItem(type, product.name, product.metadata[`feature_${type}_title`]),
                    index !== array.length - 1 && <hr key={`hr-${type}`} />,
                  ]
                )
              })}
            </div>
          )}
        </div>
        <div className={styles.planButton}>
          <PlanButton
            product={product}
            downgrading={isDowngrading}
            isSubscribedToPlan={isSubscribedProduct(product)}
            buySubscription={buySubscription}
            showManage={shouldShowManage(product)}
            isBusy={isDisabled}
            setIsBusy={setIsBusy}
          />
        </div>
      </div>
    </>
  )
}
