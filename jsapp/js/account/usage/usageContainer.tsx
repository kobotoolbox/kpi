import React, { useMemo, useState } from 'react'

import cx from 'classnames'
import type { LimitAmount, OneTimeAddOn, RecurringInterval } from '#/account/stripe.types'
import { Limits, USAGE_TYPE } from '#/account/stripe.types'
import subscriptionStore from '#/account/subscriptionStore'
import styles from '#/account/usage/usageContainer.module.scss'
import Badge from '#/components/common/badge'
import Icon from '#/components/common/icon'
import { USAGE_WARNING_RATIO } from '#/constants'
import useWhenStripeIsEnabled from '#/hooks/useWhenStripeIsEnabled.hook'
import { useLimitDisplay } from '../stripe.utils'
import OneTimeAddOnUsageModal from './oneTimeAddOnUsageModal/oneTimeAddOnUsageModal.component'

interface UsageContainerProps {
  usage: number
  remainingLimit: LimitAmount
  recurringLimit: LimitAmount
  oneTimeAddOns: OneTimeAddOn[]
  hasAddOnsLayout: boolean
  period: RecurringInterval
  label?: string
  type: USAGE_TYPE
}

const UsageContainer = ({
  usage,
  remainingLimit,
  recurringLimit,
  oneTimeAddOns,
  hasAddOnsLayout,
  period,
  type,
  label = undefined,
}: UsageContainerProps) => {
  const [isStripeEnabled, setIsStripeEnabled] = useState(false)
  const [subscriptions] = useState(() => subscriptionStore)
  const hasRecurringAddOn = useMemo(() => subscriptions.addOnsResponse.length > 0, [subscriptions.addOnsResponse])

  const displayOneTimeAddons = useMemo(() => oneTimeAddOns.length > 0, [oneTimeAddOns])

  const { limitDisplay } = useLimitDisplay()

  useWhenStripeIsEnabled(() => setIsStripeEnabled(true), [])
  let limitRatio = 0
  if (remainingLimit !== Limits.unlimited && remainingLimit) {
    limitRatio = usage / remainingLimit
  }
  const isOverLimit = limitRatio >= 1
  const isNearingLimit = !isOverLimit && limitRatio > USAGE_WARNING_RATIO

  return (
    <ul
      className={cx(styles.usage, {
        [styles.hasAddon]: hasRecurringAddOn || hasAddOnsLayout,
      })}
    >
      {isStripeEnabled && (
        <li>
          <label>{t('Available')}</label>
          <data value={remainingLimit}>{limitDisplay(type, remainingLimit)}</data>
        </li>
      )}
      <li>
        <label>{label || (period === 'month' ? t('Used this month') : t('Used this year'))}</label>
        <data>{limitDisplay(type, usage)}</data>
      </li>
      {isStripeEnabled && (
        <li className={cx(styles.balanceEntry)}>
          <label>
            <strong>{t('Balance')}</strong>
          </label>
          <div
            className={cx(styles.balanceContainer, {
              [styles.warning]: isNearingLimit,
              [styles.overlimit]: isOverLimit,
            })}
          >
            {isNearingLimit && <Icon name='warning' color='amber' size='m' />}
            {isOverLimit && <Icon name='warning' color='mid-red' size='m' />}
            <strong>{limitDisplay(type, usage, remainingLimit)}</strong>
          </div>
        </li>
      )}
      {hasRecurringAddOn && type === USAGE_TYPE.STORAGE && (
        <li>
          <Badge
            color={'light-blue'}
            size={'m'}
            label={<strong>{subscriptions.addOnsResponse[0].items?.[0].price.product.name}</strong>}
          />
        </li>
      )}
      {displayOneTimeAddons && (
        // We have already checked for "unlimited" limit amounts when filtering the addons,
        // so we can now cast limits as numbers
        <OneTimeAddOnUsageModal
          type={type}
          recurringLimit={recurringLimit as number}
          remainingLimit={remainingLimit as number}
          period={period}
          oneTimeAddOns={oneTimeAddOns}
          usage={usage}
        />
      )}
    </ul>
  )
}

export default UsageContainer
