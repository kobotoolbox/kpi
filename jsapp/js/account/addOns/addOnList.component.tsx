import React, { useContext, useEffect, useState } from 'react'

import { OneTimeAddOnRow } from '#/account/addOns/oneTimeAddOnRow.component'
import type { Organization } from '#/account/organization/organizationQuery'
import type { OneTimeAddOn, Price, Product, SubscriptionInfo } from '#/account/stripe.types'
import { isAddonProduct } from '#/account/stripe.utils'
import subscriptionStore from '#/account/subscriptionStore'
import { OneTimeAddOnsContext } from '#/account/useOneTimeAddonList.hook'
import type { BadgeColor } from '#/components/common/badge'
import Badge from '#/components/common/badge'
import useWhen from '#/hooks/useWhen.hook'
import { formatDate } from '#/utils'
import styles from './addOnList.module.scss'

/**
 * A table of add-on products along with dropdowns to purchase them.
 */
const AddOnList = (props: {
  products: Product[]
  organization: Organization | null
  isBusy: boolean
  setIsBusy: (value: boolean) => void
  onClickBuy: (price: Price) => void
}) => {
  const [subscribedAddOns, setSubscribedAddOns] = useState<SubscriptionInfo[]>([])
  const [subscribedPlans, setSubscribedPlans] = useState<SubscriptionInfo[]>([])
  const [activeSubscriptions, setActiveSubscriptions] = useState<SubscriptionInfo[]>([])
  const [addOnProducts, setAddOnProducts] = useState<Product[]>([])
  const oneTimeAddOnsContext = useContext(OneTimeAddOnsContext)
  const oneTimeAddOnSubscriptions = oneTimeAddOnsContext.oneTimeAddOns
  const oneTimeAddOnProducts = addOnProducts.filter((product) => product.metadata.product_type === 'addon_onetime')
  const recurringAddOnProducts = addOnProducts.filter((product) => product.metadata.product_type === 'addon')
  const showRecurringAddons = !subscribedPlans.length && !!recurringAddOnProducts.length

  /**
   * Extract the add-on products and prices from the list of all products
   */
  useEffect(() => {
    if (!props.products) {
      return
    }
    const addonProducts = props.products
      .filter((product) => isAddonProduct(product))
      .map((product) => {
        return {
          ...product,
          prices: product.prices.filter((price) => price.active),
        }
      })
    setAddOnProducts(addonProducts)
  }, [props.products])

  useWhen(
    () => subscriptionStore.isInitialised,
    () => {
      setSubscribedAddOns(subscriptionStore.addOnsResponse)
      setSubscribedPlans(subscriptionStore.planResponse)
      setActiveSubscriptions(subscriptionStore.activeSubscriptions)
    },
    [],
  )

  if (!addOnProducts.length || !props.organization) {
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
    <>
      <table className={styles.table}>
        <caption className={styles.caption}>
          <label className={styles.header}>{t('available add-ons')}</label>
          <p>
            {t(
              `Add-ons can be added to your Community plan to increase your usage limits. If you are approaching or
              have reached the usage limits included with your plan, increase your limits with add-ons to continue
              data collection.`,
            )}
          </p>
        </caption>
        <tbody>
          {showRecurringAddons && (
            <OneTimeAddOnRow
              key={recurringAddOnProducts.map((product) => product.id).join('-')}
              products={recurringAddOnProducts}
              isBusy={props.isBusy}
              setIsBusy={props.setIsBusy}
              subscribedAddOns={subscribedAddOns}
              activeSubscriptions={activeSubscriptions}
              organization={props.organization}
            />
          )}
          {!!oneTimeAddOnProducts.length && (
            <OneTimeAddOnRow
              key={oneTimeAddOnProducts.map((product) => product.id).join('-')}
              products={oneTimeAddOnProducts}
              isBusy={props.isBusy}
              setIsBusy={props.setIsBusy}
              subscribedAddOns={subscribedAddOns}
              activeSubscriptions={activeSubscriptions}
              organization={props.organization}
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
    </>
  )
}

export default AddOnList
