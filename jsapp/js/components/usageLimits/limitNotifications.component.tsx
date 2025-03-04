import React, { useContext, useState } from 'react'

import { Cookies } from 'react-cookie'
import { OrganizationUserRole, useOrganizationQuery } from '#/account/organization/organizationQuery'
import { UsageContext } from '#/account/usage/useUsage.hook'
import LimitBanner from '#/components/usageLimits/overLimitBanner.component'
import LimitModal from '#/components/usageLimits/overLimitModal.component'
import { useExceedingLimits } from '#/components/usageLimits/useExceedingLimits.hook'
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

  const [usage] = useContext(UsageContext)
  const limits = useExceedingLimits()

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
      (limits.exceedList.includes('storage') || limits.exceedList.includes('submission'))
    ) {
      setShowModal(true)
    }
    if (limitsCookie) {
      setDismissed(true)
    }
  }, [limits])

  const modalDismissed = () => {
    setDismissed(true)
    const dateNow = new Date()
    const expireDate = new Date(dateNow.setDate(dateNow.getDate() + 1))
    cookies.set('kpiOverLimitsCookie', {
      expires: expireDate,
    })
  }

  if (!stripeEnabled) {
    return null
  }

  return (
    <>
      {dismissed && (
        <LimitBanner interval={usage.trackingPeriod} limits={limits.exceedList} accountPage={Boolean(accountPage)} />
      )}
      {!limits.exceedList.length && (
        <LimitBanner
          warning
          interval={usage.trackingPeriod}
          limits={limits.warningList}
          accountPage={Boolean(accountPage)}
        />
      )}
      {useModal && (
        <LimitModal
          show={showModal}
          limits={limits.exceedList}
          interval={usage.trackingPeriod}
          dismissed={modalDismissed}
        />
      )}
    </>
  )
}

export default LimitNotifications
