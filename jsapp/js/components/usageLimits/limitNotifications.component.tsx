import React, { useState } from 'react'

import { Cookies } from 'react-cookie'
import { UsageLimitTypes } from '#/account/stripe.types'
import { useServiceUsageQuery } from '#/account/usage/useServiceUsageQuery'
import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import { useOrganizationsRetrieve } from '#/api/react-query/organizations'
import LimitBanner from '#/components/usageLimits/overLimitBanner.component'
import LimitModal from '#/components/usageLimits/overLimitModal.component'
import useWhenStripeIsEnabled from '#/hooks/useWhenStripeIsEnabled.hook'
import { useSession } from '#/stores/useSession'

const cookies = new Cookies()

interface LimitNotificationsProps {
  pageCanShowModal?: boolean
  accountPage?: boolean
}

const LimitNotifications = ({ pageCanShowModal = false, accountPage = false }: LimitNotificationsProps) => {
  const [modalDismissed, setModalDismissed] = useState(false)
  const [stripeEnabled, setStripeEnabled] = useState(false)

  const { data: serviceUsageData } = useServiceUsageQuery()

  const session = useSession()
  const organizationId = session.isPending ? undefined : session.currentLoggedAccount?.organization?.uid!
  const orgQuery = useOrganizationsRetrieve(organizationId!)

  // Only show modal on certain pages (set by parent), only to non-MMO users and MMO users with role of 'owner',
  // and only show if list of exceeded limits includes storage or submissions
  const useModal =
    pageCanShowModal &&
    (orgQuery.data?.status === 200 && (!orgQuery.data.data.is_mmo || orgQuery.data.data.request_user_role === MemberRoleEnum.owner)) &&
    (serviceUsageData?.limitExceedList.includes(UsageLimitTypes.STORAGE) ||
      serviceUsageData?.limitExceedList.includes(UsageLimitTypes.SUBMISSION))

  useWhenStripeIsEnabled(() => {
    setStripeEnabled(true)
    // only check cookies if we will display a modal
    if (!useModal) {
      return
    }
    const limitsCookie = cookies.get('kpiOverLimitsCookie')
    if (limitsCookie) {
      setModalDismissed(true)
    }
  }, [])

  const dismissModal = () => {
    setModalDismissed(true)
    const dateNow = new Date()
    const expireDate = new Date(dateNow.setDate(dateNow.getDate() + 1))
    cookies.set('kpiOverLimitsCookie', {
      expires: expireDate,
    })
  }

  if (!stripeEnabled || !serviceUsageData) {
    return null
  }

  // We only want to display exceeded limit notifications for submissions and storage
  // in the modal
  const modalLimits = serviceUsageData.limitExceedList.filter((limit) =>
    [UsageLimitTypes.STORAGE, UsageLimitTypes.SUBMISSION].includes(limit),
  )

  return (
    <>
      <LimitBanner
        warning={!serviceUsageData.limitExceedList.length}
        limits={
          serviceUsageData.limitExceedList.length ? serviceUsageData.limitExceedList : serviceUsageData.limitWarningList
        }
        accountPage={Boolean(accountPage)}
      />
      {useModal && <LimitModal show={!modalDismissed} limits={modalLimits} dismissed={dismissModal} />}
    </>
  )
}

export default LimitNotifications
