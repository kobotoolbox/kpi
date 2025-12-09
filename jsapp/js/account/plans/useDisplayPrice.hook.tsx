import { useMemo } from 'react'

import type { Price } from '#/account/stripe.types'

export const useDisplayPrice = (price?: Price | null) =>
  useMemo(() => {
    if (!price?.unit_amount) {
      return t('Free')
    }
    let totalPrice = price.unit_amount / 100
    if (price?.recurring?.interval === 'year') {
      totalPrice /= 12
    }
    if (!price?.recurring?.interval) {
      return t('$##price##').replace('##price##', totalPrice.toFixed(2))
    }
    return t('$##price## USD/month').replace('##price##', totalPrice.toFixed(2))
  }, [price])
