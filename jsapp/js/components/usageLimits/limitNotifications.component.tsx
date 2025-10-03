import React, { useState } from 'react'

import { Cookies } from 'react-cookie'
import { UsageLimitTypes } from '#/account/stripe.types'
import { useOrganizationsServiceUsageSummary } from '#/account/usage/useOrganizationsServiceUsageSummary'
import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import { getOrganizationsRetrieveQueryKey, useOrganizationsRetrieve } from '#/api/react-query/organizations'
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

  const { data: serviceUsageData } = useOrganizationsServiceUsageSummary()

  const session = useSession()
  const organizationId = session.isPending ? undefined : session.currentLoggedAccount?.organization?.uid
  const orgQuery = useOrganizationsRetrieve(organizationId!, {
    query: {
      queryKey: getOrganizationsRetrieveQueryKey(organizationId!), // Note: see Orval issue https://github.com/orval-labs/orval/issues/2396
      staleTime: Number.POSITIVE_INFINITY,
    },
  })

  // Only show modal on certain pages (set by parent), only to non-MMO users and MMO users with role of 'owner',
  // and only show if list of exceeded limits includes storage or submissions
  const useModal =
    pageCanShowModal &&
    orgQuery.data?.status === 200 &&
    (!orgQuery.data.data.is_mmo || orgQuery.data.data.request_user_role === MemberRoleEnum.owner) &&
    serviceUsageData?.status === 200 &&
    (serviceUsageData?.data.limitExceedList.includes(UsageLimitTypes.STORAGE) ||
      serviceUsageData?.data.limitExceedList.includes(UsageLimitTypes.SUBMISSION))

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

  if (!stripeEnabled || serviceUsageData?.status !== 200) {
    return null
  }

  // We only want to display exceeded limit notifications for submissions and storage
  // in the modal
  const modalLimits = serviceUsageData.data.limitExceedList.filter((limit) =>
    [UsageLimitTypes.STORAGE, UsageLimitTypes.SUBMISSION].includes(limit),
  )

  return (
    <>
      <LimitBanner
        warning={!serviceUsageData.data.limitExceedList.length}
        limits={
          serviceUsageData.data.limitExceedList.length
            ? serviceUsageData.data.limitExceedList
            : serviceUsageData.data.limitWarningList
        }
        accountPage={Boolean(accountPage)}
      />
      {useModal && <LimitModal show={!modalDismissed} limits={modalLimits} dismissed={dismissModal} />}
    </>
  )
}

export default LimitNotifications
