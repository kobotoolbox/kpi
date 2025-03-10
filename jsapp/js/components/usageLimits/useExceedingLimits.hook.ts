import { useContext, useEffect, useReducer, useState } from 'react'

import { when } from 'mobx'
import { getAccountLimits } from '#/account/stripe.api'
import { type SubscriptionInfo, UsageLimitTypes } from '#/account/stripe.types'
import subscriptionStore from '#/account/subscriptionStore'
import { UsageContext } from '#/account/usage/useUsage.hook'
import { OneTimeAddOnsContext } from '#/account/useOneTimeAddonList.hook'
import { ProductsContext } from '#/account/useProducts.hook'
import { USAGE_WARNING_RATIO } from '#/constants'
import useWhenStripeIsEnabled from '#/hooks/useWhenStripeIsEnabled.hook'

interface SubscribedState {
  subscribedProduct: null | SubscriptionInfo
}

const initialState = {
  subscribedProduct: null,
}

function subscriptionReducer(state: SubscribedState, action: { prodData: any }) {
  return { ...state, subscribedProduct: action.prodData }
}

export const useExceedingLimits = () => {
  const [state, dispatch] = useReducer(subscriptionReducer, initialState)
  const [usage, _, usageStatus] = useContext(UsageContext)
  const [productsContext] = useContext(ProductsContext)
  const oneTimeAddOnsContext = useContext(OneTimeAddOnsContext)

  const [exceedList, setExceedList] = useState<string[]>([])
  const [warningList, setWarningList] = useState<string[]>([])

  const [subscribedStorageLimit, setSubscribedStorageLimit] = useState<number | string>()
  const [subscribedSubmissionLimit, setSubscribedSubmissionLimit] = useState<number | string>()
  const [subscribedTranscriptionMinutes, setTranscriptionMinutes] = useState<number | string>()
  const [subscribedTranslationChars, setTranslationChars] = useState<number | string>()
  const [areLimitsLoaded, setAreLimitsLoaded] = useState(false)

  // Get products and get default limits for community plan
  useWhenStripeIsEnabled(() => {
    if (productsContext.isLoaded && oneTimeAddOnsContext.isLoaded) {
      getAccountLimits(productsContext.products, oneTimeAddOnsContext.oneTimeAddOns).then((limits) => {
        setSubscribedSubmissionLimit(limits.remainingLimits.submission_limit)
        setSubscribedStorageLimit(limits.remainingLimits.storage_bytes_limit)
        setTranscriptionMinutes(limits.remainingLimits.asr_seconds_limit)
        setTranslationChars(limits.remainingLimits.mt_characters_limit)
        setAreLimitsLoaded(true)
      })
    }
  }, [
    productsContext.isLoaded,
    productsContext.products,
    oneTimeAddOnsContext.isLoaded,
    oneTimeAddOnsContext.oneTimeAddOns,
  ])

  // Get subscription data
  useWhenStripeIsEnabled(
    () =>
      when(
        () => subscriptionStore.isInitialised,
        () => {
          dispatch({
            prodData: subscriptionStore.planResponse,
          })
        },
      ),
    [],
  )

  function isOverLimit(
    subscribedLimit: number | string | undefined,
    currentUsage: number | undefined,
    listString: string,
  ) {
    if (subscribedLimit && typeof subscribedLimit === 'number' && typeof currentUsage === 'number') {
      if (currentUsage >= subscribedLimit) {
        setExceedList((prevState) => prevState.concat([listString]))
      } else if (currentUsage >= subscribedLimit * USAGE_WARNING_RATIO) {
        setWarningList((prevState) => prevState.concat([listString]))
      }
    }
  }

  // Check if usage is more than limit
  useEffect(() => {
    if (usageStatus.error || usageStatus.pending || !areLimitsLoaded) {
      return
    }

    // Reset lists or else there will be duplicates
    setExceedList(() => [])
    setWarningList(() => [])

    isOverLimit(subscribedStorageLimit, usage.storage, UsageLimitTypes.STORAGE)
    isOverLimit(subscribedSubmissionLimit, usage.submissions, UsageLimitTypes.SUBMISSION)
    isOverLimit(subscribedTranscriptionMinutes, usage.transcriptionMinutes, UsageLimitTypes.TRANSCRIPTION)
    isOverLimit(subscribedTranslationChars, usage.translationChars, UsageLimitTypes.TRANSLATION)
  }, [usageStatus, areLimitsLoaded])

  return { exceedList, warningList }
}
