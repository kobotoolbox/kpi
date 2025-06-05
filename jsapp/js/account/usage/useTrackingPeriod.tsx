import { useEffect, useState } from 'react'
import { getSubscriptionInterval } from '../stripe.api'
import type { RecurringInterval } from '../stripe.types'

export const useTrackingPeriod = (): RecurringInterval => {
  const [trackingPeriod, setTrackingPeriod] = useState<RecurringInterval>('month')

  useEffect(() => {
    const fetchTrackingPeriod = async () => {
      setTrackingPeriod(await getSubscriptionInterval())
    }
    fetchTrackingPeriod()
  }, [])

  return trackingPeriod
}
