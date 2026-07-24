import React, { useContext, useMemo } from 'react'

import { type OneTimeAddOn, USAGE_TYPE } from '#/account/stripe.types'
import { useLimitDisplay } from '#/account/stripe.utils'
import { ProductsContext } from '#/account/useProducts.hook'
import styles from './oneTimeAddOnList.module.scss'

interface OneTimeAddOnList {
  type: USAGE_TYPE
  oneTimeAddOns: OneTimeAddOn[]
}

function OneTimeAddOnList(props: OneTimeAddOnList) {
  const [productsContext] = useContext(ProductsContext)
  const { limitDisplay } = useLimitDisplay()

  const formattedAddOns = useMemo(
    () =>
      props.oneTimeAddOns.map((addon) => {
        const productName =
          productsContext.products.find((product) => product.id === addon.product)?.name ?? 'One-Time Addon'

        let remainingLimit = 0
        switch (props.type) {
          case USAGE_TYPE.SUBMISSIONS:
            remainingLimit = addon.limits_remaining.submission_limit ?? 0
            break
          case USAGE_TYPE.TRANSCRIPTION:
            remainingLimit = addon.limits_remaining.asr_seconds_limit ?? 0
            remainingLimit = remainingLimit / 60
            break
          case USAGE_TYPE.TRANSLATION:
            remainingLimit = addon.limits_remaining.mt_characters_limit ?? 0
            break
          case USAGE_TYPE.LLM:
            remainingLimit = addon.limits_remaining.llm_requests_limit ?? 0
            break
          default:
            break
        }
        return {
          productName,
          remainingLimit,
        }
      }),
    [props.oneTimeAddOns, props.type, productsContext.isLoaded],
  )

  return (
    <div className={styles.oneTimeAddOnListContainer}>
      {formattedAddOns.map((addon, i) => (
        <div className={styles.oneTimeAddOnListEntry} key={i}>
          <label className={styles.productName}>
            <span>{addon.productName}</span>
          </label>
          <div>
            {t('##REMAINING## remaining').replace('##REMAINING##', limitDisplay(props.type, addon.remainingLimit))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default OneTimeAddOnList
