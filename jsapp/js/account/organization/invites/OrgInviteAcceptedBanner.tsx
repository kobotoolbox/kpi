import React, { useEffect, useState } from 'react'

import { MemberInviteStatus } from '#/account/organization/membersInviteQuery'
import { useOrganizationMemberDetailQuery } from '#/account/organization/membersQuery'
import type { Organization } from '#/account/organization/organizationQuery'
import Alert from '#/components/common/alert'
import { useSafeUsernameStorageKey } from '#/hooks/useSafeUsernameStorageKey'

interface OrgInviteAcceptedBannerProps {
  username: string
  organization: Organization
}

const BANNER_DISMISSAL_VALUE = 'dismissed'

/**
 * Displays a banner to a user that has joined organization. It will be displayed indefinitely (until user dismisses it
 * with "x" button). Dismissal is being stored in `localStorage`.
 *
 * Note: this is for a user that is part of an organization (and thus has access to it).
 */
export default function OrgInviteAcceptedBanner(props: OrgInviteAcceptedBannerProps) {
  const organizationMemberDetailQuery = useOrganizationMemberDetailQuery(props.username, false)
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean | undefined>()
  const [localStorageKeyPrefix, setLocalStorageKeyPrefix] = useState<string | undefined>()
  const localStorageKey = useSafeUsernameStorageKey(localStorageKeyPrefix, props.username)

  // Build local storage prefix when invite data is ready.
  useEffect(() => {
    if (organizationMemberDetailQuery.data?.invite?.url) {
      // For the local storage key we include invite url (it has an id), because otherwise the banner would not appear
      // when user would leave one organization and join another (or rejoin the same one).
      setLocalStorageKeyPrefix(`kpiOrgInviteAcceptedBanner-${organizationMemberDetailQuery.data?.invite?.url}`)
    }
  }, [organizationMemberDetailQuery.data])

  // Get information whether the banner was already dismissed by user. It requires localStorage key to be ready.
  useEffect(() => {
    const bannerStatus = localStorageKey && localStorage.getItem(localStorageKey)
    setIsBannerDismissed(bannerStatus === BANNER_DISMISSAL_VALUE)
  }, [localStorageKey])

  // Close the dialog box and store that we've closed it
  function handleCloseBanner() {
    if (localStorageKey) {
      localStorage.setItem(localStorageKey, BANNER_DISMISSAL_VALUE)
      setIsBannerDismissed(true)
    }
  }

  if (
    // Only show banner to users who are members of MMO organization
    !props.organization.is_mmo ||
    // Only show banner to users who have accepted the invite
    organizationMemberDetailQuery.data?.invite?.status !== MemberInviteStatus.accepted ||
    // Wait for local storage information
    isBannerDismissed === undefined ||
    // Respect users who dismissed the banner
    isBannerDismissed === true
  ) {
    return null
  }

  return (
    // We wrap it in a div to avoid flexbox squashing the content.
    <div>
      <Alert type='info' mt='md' ml='md' mr='md' iconName='information' withCloseButton onClose={handleCloseBanner}>
        {t(
          'This account is now managed by ##TEAM_OR_ORGANIZATION_NAME##. All projects previously owned by your ' +
            'account are currently being transfered and will be owned by ##TEAM_OR_ORGANIZATION_NAME##. This process ' +
            'can take up to a few minutes to complete.',
        ).replaceAll('##TEAM_OR_ORGANIZATION_NAME##', props.organization.name)}
      </Alert>
    </div>
  )
}
