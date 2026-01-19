import React, { useContext, useEffect, useState } from 'react'

import { AddOnProductRow } from '#/account/addOns/addOnProductRow.component'
import type { OneTimeAddOn, Product, SubscriptionInfo } from '#/account/stripe.types'
import { isAddonProduct } from '#/account/stripe.utils'
import subscriptionStore from '#/account/subscriptionStore'
import { YourPlan } from '#/account/usage/yourPlan.component'
import { OneTimeAddOnsContext } from '#/account/useOneTimeAddonList.hook'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import type { BadgeColor } from '#/components/common/badge'
import Badge from '#/components/common/badge'
import LimitNotifications from '#/components/usageLimits/limitNotifications.component'
import useWhen from '#/hooks/useWhen.hook'
import { formatDate } from '#/utils'
import { ProductsContext } from '../useProducts.hook'
import styles from './addOns.module.scss'

export default function addOns() {
  const [subscribedAddOns, setSubscribedAddOns] = useState<SubscriptionInfo[]>([])
  const [subscribedPlans, setSubscribedPlans] = useState<SubscriptionInfo[]>([])
  const [addOnProducts, setAddOnProducts] = useState<Product[]>([])
  const [organization] = useOrganizationAssumed()
  const [products] = useContext(ProductsContext)
  const [isBusy, setIsBusy] = useState(true)
  const oneTimeAddOnsContext = useContext(OneTimeAddOnsContext)
  const oneTimeAddOnSubscriptions = oneTimeAddOnsContext.oneTimeAddOns
  const oneTimeAddOnProducts = addOnProducts.filter((product) => product.metadata.product_type === 'addon_onetime')
  const recurringAddOnProducts = addOnProducts.filter((product) => product.metadata.product_type === 'addon')
  const showRecurringAddons = !subscribedPlans.length && !!recurringAddOnProducts.length

  /**
   * Extract the add-on products and prices from the list of all products
   */
  useEffect(() => {
    if (!products.products) {
      return
    }
    const addonProducts = products.products
      .filter((product) => isAddonProduct(product))
      .map((product) => {
        return {
          ...product,
          prices: product.prices.filter((price) => price.active),
        }
      })
    setAddOnProducts(addonProducts)
  }, [products.products])

  useWhen(
    () => subscriptionStore.isInitialised,
    () => {
      setSubscribedAddOns(subscriptionStore.addOnsResponse)
      setSubscribedPlans(subscriptionStore.planResponse)
      setIsBusy(false)
    },
    [],
  )

  if (!addOnProducts.length) {
    return null
  }

  function ActivePreviousAddons(
    addOns: SubscriptionInfo[],
    oneTimeAddOns: OneTimeAddOn[],
    activeStatus: string,
    available: boolean,
    label: string,
    badgeLabel: string,
    color: BadgeColor,
  ) {
    return (
      <table className={styles.table}>
        <caption className={`${styles.caption} ${styles.purchasedAddOns}`}>
          <label className={styles.header}>{label}</label>
        </caption>
        <tbody>
          {addOns.map((product) => {
            if (product.status === activeStatus) {
              return (
                <tr className={styles.row} key={product.id}>
                  <td className={styles.product}>
                    <span className={styles.productName}>{product.items[0].price.product.name}</span>
                    <Badge color={color} size={'s'} label={badgeLabel} />
                    <p className={styles.description}>
                      {t('Added on ##date##').replace('##date##', formatDate(product.created))}
                    </p>
                  </td>
                  <td className={styles.activePrice}>
                    {product.items[0].price.human_readable_price.replace('USD/month', '').replace('USD/year', '')}
                  </td>
                </tr>
              )
            }
            return null
          })}
          {oneTimeAddOns.map((oneTimeAddOn: OneTimeAddOn) => {
            if (oneTimeAddOn.is_available === available) {
              return (
                <tr className={styles.row} key={oneTimeAddOn.id}>
                  <td className={styles.product}>
                    <span className={styles.productName}>
                      {t('##name##').replace(
                        '##name##',
                        oneTimeAddOnProducts.find((product) => product.id === oneTimeAddOn.product)?.name || label,
                      )}
                    </span>
                    <Badge color={color} size={'s'} label={badgeLabel} />
                    <p className={styles.addonDescription}>
                      {t('Added on ##date##').replace('##date##', formatDate(oneTimeAddOn.created))}
                    </p>
                  </td>
                  <td className={styles.activePrice}>
                    {'$##price##'.replace(
                      '##price##',
                      (
                        (oneTimeAddOnProducts.find((product) => product.id === oneTimeAddOn.product)?.prices[0]
                          .unit_amount || 0) / 100
                      ).toFixed(2),
                    )}
                  </td>
                </tr>
              )
            }
            return null
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div className={styles.root}>
      <LimitNotifications accountPage />
      <header className={styles.header}>
        <h2 className={styles.headerText}>{t('Your plan')}</h2>
      </header>
      <YourPlan />
      <>
        <div className={styles.wrapper}>
          <table className={styles.table}>
            <caption className={styles.caption}>
              <label className={styles.addOnsHeader}>{t('available add-ons')}</label>
              <p>
                {t(
                  `You can add add-ons to increase your usage caps as needed when you are close to or over your plan's limits.`,
                )}
              </p>
            </caption>
            <tbody>
              {showRecurringAddons && (
                <AddOnProductRow
                  key={recurringAddOnProducts.map((product) => product.id).join('-')}
                  products={recurringAddOnProducts}
                  isBusy={isBusy}
                  setIsBusy={setIsBusy}
                  subscribedAddOns={subscribedAddOns}
                  organization={organization}
                  isRecurring
                />
              )}
              {!!oneTimeAddOnProducts.length && (
                <AddOnProductRow
                  key={oneTimeAddOnProducts.map((product) => product.id).join('-')}
                  products={oneTimeAddOnProducts}
                  isBusy={isBusy}
                  setIsBusy={setIsBusy}
                  subscribedAddOns={subscribedAddOns}
                  organization={organization}
                />
              )}
            </tbody>
          </table>
          {subscribedAddOns.some((product) => product.status === 'active') ||
          oneTimeAddOnSubscriptions.some((oneTimeAddOns) => oneTimeAddOns.is_available)
            ? ActivePreviousAddons(
                subscribedAddOns,
                oneTimeAddOnSubscriptions,
                'active',
                true,
                t('your active add-ons'),
                t('Active'),
                'light-teal',
              )
            : null}

          {subscribedAddOns.some((product) => product.status !== 'active') ||
          oneTimeAddOnSubscriptions.some((oneTimeAddOns) => !oneTimeAddOns.is_available)
            ? ActivePreviousAddons(
                subscribedAddOns,
                oneTimeAddOnSubscriptions,
                'inactive',
                false,
                t('previous add-ons'),
                t('Inactive'),
                'light-storm',
              )
            : null}
        </div>
      </>
    </div>
  )
}
