import React, { useContext, useEffect, useMemo, useState } from 'react'

import { Group, LoadingOverlay } from '@mantine/core'
import { when } from 'mobx'
import { useLocation } from 'react-router-dom'
import { getAccountLimits } from '#/account/stripe.api'
import type { AccountLimitDetail, LimitAmount } from '#/account/stripe.types'
import { Limits, USAGE_TYPE } from '#/account/stripe.types'
import subscriptionStore from '#/account/subscriptionStore'
import UsageContainer from '#/account/usage/usageContainer'
import { YourPlan } from '#/account/usage/yourPlan.component'
import LimitNotifications from '#/components/usageLimits/limitNotifications.component'
import envStore from '#/envStore'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import useWhenStripeIsEnabled from '#/hooks/useWhenStripeIsEnabled.hook'
import { convertSecondsToMinutes, formatDate } from '#/utils'
import { OneTimeAddOnsContext } from '../useOneTimeAddonList.hook'
import { ProductsContext } from '../useProducts.hook'
import styles from './usage.module.scss'
import { useBillingPeriod } from './useBillingPeriod'
import {
  type OrganizationsServiceUsageSummary,
  useOrganizationsServiceUsageSummary,
} from './useOrganizationsServiceUsageSummary'

interface LimitState {
  storageByteRemainingLimit: LimitAmount
  storageByteRecurringLimit: LimitAmount
  nlpCharacterRemainingLimit: LimitAmount
  nlpCharacterRecurringLimit: LimitAmount
  nlpMinuteRemainingLimit: LimitAmount
  nlpMinuteRecurringLimit: LimitAmount
  submissionsRemainingLimit: LimitAmount
  submissionsRecurringLimit: LimitAmount
  llmRequestsRemainingLimit: LimitAmount
  llmRequestsRecurringLimit: LimitAmount
  isLoaded: boolean
  stripeEnabled: boolean
}

export default function Usage() {
  const [products] = useContext(ProductsContext)
  const oneTimeAddOnsContext = useContext(OneTimeAddOnsContext)

  const [limits, setLimits] = useState<LimitState>({
    storageByteRemainingLimit: Limits.unlimited,
    storageByteRecurringLimit: Limits.unlimited,
    nlpCharacterRemainingLimit: Limits.unlimited,
    nlpCharacterRecurringLimit: Limits.unlimited,
    nlpMinuteRemainingLimit: Limits.unlimited,
    nlpMinuteRecurringLimit: Limits.unlimited,
    submissionsRemainingLimit: Limits.unlimited,
    submissionsRecurringLimit: Limits.unlimited,
    llmRequestsRemainingLimit: Limits.unlimited,
    llmRequestsRecurringLimit: Limits.unlimited,
    isLoaded: false,
    stripeEnabled: false,
  })

  const usageQuery = useOrganizationsServiceUsageSummary({ staleTime: 0 /** fetch fresh data! */ })
  const { billingPeriod } = useBillingPeriod()

  const location = useLocation()

  const dateRange = useMemo(() => {
    if (usageQuery.data?.status !== 200) return ''
    const startDate = formatDate(usageQuery.data.data.currentPeriodStart)
    const endDate = formatDate(usageQuery.data.data.currentPeriodEnd)
    return t('##start_date## to ##end_date##').replace('##start_date##', startDate).replace('##end_date##', endDate)
  }, [
    (usageQuery.data?.data as OrganizationsServiceUsageSummary)?.currentPeriodStart,
    (usageQuery.data?.data as OrganizationsServiceUsageSummary)?.currentPeriodEnd,
  ])

  // check if stripe is enabled - if so, get limit data
  useEffect(() => {
    const getLimits = async () => {
      await when(() => envStore.isReady)
      let AccountLimits: AccountLimitDetail
      if (envStore.data.stripe_public_key) {
        AccountLimits = await getAccountLimits(products.products, oneTimeAddOnsContext.oneTimeAddOns)
      } else {
        setLimits((prevState) => {
          return {
            ...prevState,
            isLoaded: true,
          }
        })
        return
      }

      setLimits((prevState) => {
        return {
          ...prevState,
          storageByteRemainingLimit: AccountLimits.remainingLimits.storage_bytes_limit,
          storageByteRecurringLimit: AccountLimits.recurringLimits.storage_bytes_limit,
          nlpCharacterRemainingLimit: AccountLimits.remainingLimits.mt_characters_limit,
          nlpCharacterRecurringLimit: AccountLimits.recurringLimits.mt_characters_limit,
          nlpMinuteRemainingLimit:
            typeof AccountLimits.remainingLimits.asr_seconds_limit === 'number'
              ? convertSecondsToMinutes(AccountLimits.remainingLimits.asr_seconds_limit)
              : AccountLimits.remainingLimits.asr_seconds_limit,
          nlpMinuteRecurringLimit:
            typeof AccountLimits.recurringLimits.asr_seconds_limit === 'number'
              ? convertSecondsToMinutes(AccountLimits.recurringLimits.asr_seconds_limit)
              : AccountLimits.recurringLimits.asr_seconds_limit,
          submissionsRemainingLimit: AccountLimits.remainingLimits.submission_limit,
          submissionsRecurringLimit: AccountLimits.recurringLimits.submission_limit,
          llmRequestsRemainingLimit: AccountLimits.remainingLimits.llm_requests_limit,
          llmRequestsRecurringLimit: AccountLimits.recurringLimits.llm_requests_limit,
          isLoaded: true,
          stripeEnabled: true,
        }
      })
    }

    getLimits()
  }, [products.isLoaded, oneTimeAddOnsContext.isLoaded])

  function filterAddOns(type: USAGE_TYPE) {
    const availableAddons = oneTimeAddOnsContext.oneTimeAddOns.filter((addon) => addon.is_available)
    // Find the relevant addons, but first check and make sure add-on
    // limits aren't superceded by an "unlimited" usage limit.
    switch (type) {
      case USAGE_TYPE.SUBMISSIONS:
        return limits.submissionsRecurringLimit !== Limits.unlimited
          ? availableAddons.filter((addon) => addon.total_usage_limits.submission_limit)
          : []
      case USAGE_TYPE.TRANSCRIPTION:
        return limits.nlpMinuteRecurringLimit !== Limits.unlimited
          ? availableAddons.filter((addon) => addon.total_usage_limits.asr_seconds_limit)
          : []
      case USAGE_TYPE.TRANSLATION:
        return limits.nlpCharacterRecurringLimit !== Limits.unlimited
          ? availableAddons.filter((addon) => addon.total_usage_limits.mt_characters_limit)
          : []
      case USAGE_TYPE.LLM:
        return limits.llmRequestsRecurringLimit !== Limits.unlimited
          ? availableAddons.filter((addon) => addon.total_usage_limits.llm_requests_limit)
          : []
      default:
        return []
    }
  }

  // if stripe is enabled, load fresh subscription info whenever we navigate to this route
  useWhenStripeIsEnabled(() => {
    subscriptionStore.fetchSubscriptionInfo()
  }, [location])

  if (
    usageQuery.isLoading ||
    !usageQuery.isFetchedAfterMount ||
    usageQuery.data?.status !== 200 ||
    !limits.isLoaded ||
    (limits.stripeEnabled && (!products.isLoaded || !oneTimeAddOnsContext.isLoaded))
  ) {
    return <LoadingOverlay visible={true} />
  }

  return (
    <div className={styles.root}>
      <LimitNotifications accountPage />
      <header className={styles.header}>
        <h2 className={styles.headerText}>{t('Your usage')}</h2>
      </header>
      {limits.stripeEnabled && <YourPlan />}
      <Group align='stretch'>
        <UsageContainer
          usage={usageQuery.data.data.submissions}
          remainingLimit={limits.submissionsRemainingLimit}
          recurringLimit={limits.submissionsRecurringLimit}
          oneTimeAddOns={filterAddOns(USAGE_TYPE.SUBMISSIONS)}
          period={billingPeriod}
          type={USAGE_TYPE.SUBMISSIONS}
          title={'Submissions'}
          dateRange={dateRange}
        />
        <UsageContainer
          usage={usageQuery.data.data.storage}
          remainingLimit={limits.storageByteRemainingLimit}
          recurringLimit={limits.storageByteRecurringLimit}
          oneTimeAddOns={filterAddOns(USAGE_TYPE.STORAGE)}
          period={billingPeriod}
          label={t('Total')}
          type={USAGE_TYPE.STORAGE}
          title={t('File storage')}
          dateRange={'per account'}
        />
        <UsageContainer
          usage={usageQuery.data.data.transcriptionMinutes}
          remainingLimit={limits.nlpMinuteRemainingLimit}
          recurringLimit={limits.nlpMinuteRecurringLimit}
          oneTimeAddOns={filterAddOns(USAGE_TYPE.TRANSCRIPTION)}
          period={billingPeriod}
          type={USAGE_TYPE.TRANSCRIPTION}
          title={t('Transcription minutes')}
          dateRange={dateRange}
        />
        <UsageContainer
          usage={usageQuery.data.data.translationChars}
          remainingLimit={limits.nlpCharacterRemainingLimit}
          recurringLimit={limits.nlpCharacterRecurringLimit}
          oneTimeAddOns={filterAddOns(USAGE_TYPE.TRANSLATION)}
          period={billingPeriod}
          type={USAGE_TYPE.TRANSLATION}
          title={t('Translation characters')}
          dateRange={dateRange}
        />
        {useFeatureFlag(FeatureFlag.autoQAEnabled) && (
          <UsageContainer
            usage={usageQuery.data.data.llm_requests.llm_requests_current_period}
            remainingLimit={limits.llmRequestsRemainingLimit}
            recurringLimit={limits.llmRequestsRecurringLimit}
            oneTimeAddOns={filterAddOns(USAGE_TYPE.LLM)}
            period={billingPeriod}
            type={USAGE_TYPE.LLM}
            title={t('LLM requests')}
            dateRange={dateRange}
          />
        )}
      </Group>
    </div>
  )
}
