import React, { useState } from 'react'

import { Cookies } from 'react-cookie'
import { OrganizationUserRole, useOrganizationQuery } from '#/account/organization/organizationQuery'
import { UsageLimitTypes } from '#/account/stripe.types'
import { useBillingPeriod } from '#/account/usage/useBillingPeriod'
import { useServiceUsageQuery } from '#/account/usage/useServiceUsageQuery'
import LimitBanner from '#/components/usageLimits/overLimitBanner.component'
import LimitModal from '#/components/usageLimits/overLimitModal.component'
import useWhenStripeIsEnabled from '#/hooks/useWhenStripeIsEnabled.hook'

const cookies = new Cookies()

interface LimitNotificationsProps {
  useModal?: boolean
  accountPage?: boolean
}

const LimitNotifications = ({ useModal = false, accountPage = false }: LimitNotificationsProps) => {
  const [showModal, setShowModal] = useState(false)
  const [dismissed, setDismissed] = useState(!useModal)
  const [stripeEnabled, setStripeEnabled] = useState(false)

  const { billingPeriod } = useBillingPeriod()

  const { data: serviceUsageData } = useServiceUsageQuery()

  const orgQuery = useOrganizationQuery()

  useWhenStripeIsEnabled(() => {
    setStripeEnabled(true)
    // only check cookies if we're displaying a modal
    if (!useModal) {
      return
    }

    const limitsCookie = cookies.get('kpiOverLimitsCookie')
    if (
      (!orgQuery.data?.is_mmo || orgQuery.data?.request_user_role === OrganizationUserRole.owner) &&
      limitsCookie === undefined &&
      (serviceUsageData?.limitExceedList.includes(UsageLimitTypes.STORAGE) ||
        serviceUsageData?.limitExceedList.includes(UsageLimitTypes.SUBMISSION))
    ) {
      setShowModal(true)
    }
    if (limitsCookie) {
      setDismissed(true)
    }
  }, [serviceUsageData, orgQuery.data, useModal])

  const modalDismissed = () => {
    setDismissed(true)
    const dateNow = new Date()
    const expireDate = new Date(dateNow.setDate(dateNow.getDate() + 1))
    cookies.set('kpiOverLimitsCookie', {
      expires: expireDate,
    })
  }

  if (!stripeEnabled || !serviceUsageData) {
    return null
  }

  return (
    <>
      {dismissed && (
        <LimitBanner
          interval={billingPeriod}
          limits={serviceUsageData.limitExceedList}
          accountPage={Boolean(accountPage)}
        />
      )}
      {!serviceUsageData.limitExceedList.length && (
        <LimitBanner
          warning
          interval={billingPeriod}
          limits={serviceUsageData.limitWarningList}
          accountPage={Boolean(accountPage)}
        />
      )}
      {useModal && (
        <LimitModal
          show={showModal}
          limits={serviceUsageData.limitExceedList}
          interval={billingPeriod}
          dismissed={modalDismissed}
        />
      )}
    </>
  )
}

export default LimitNotifications
