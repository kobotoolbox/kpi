import React, { useEffect, useState } from 'react'
import { InviteStatusChoicesEnum } from '#/api/models/inviteStatusChoicesEnum'
import type { MemberListResponse } from '#/api/models/memberListResponse'
import type { OrganizationResponse } from '#/api/models/organizationResponse'
import {
  getOrganizationsMembersRetrieveQueryKey,
  useOrganizationsMembersRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import Alert from '#/components/common/alert'
import { useSafeUsernameStorageKey } from '#/hooks/useSafeUsernameStorageKey'

interface OrgInviteAcceptedBannerProps {
  username: string
  organization: OrganizationResponse
}

const BANNER_DISMISSAL_VALUE = 'dismissed'

/**
 * Displays a banner to a user that has joined organization. It will be displayed indefinitely (until user dismisses it
 * with "x" button). Dismissal is being stored in `localStorage`.
 *
 * Note: this is for a user that is part of an organization (and thus has access to it).
 */
export default function OrgInviteAcceptedBanner({ username, organization }: OrgInviteAcceptedBannerProps) {
  const orgMemberQuery = useOrganizationsMembersRetrieve(organization.id, username, {
    query: {
      queryKey: getOrganizationsMembersRetrieveQueryKey(organization.id, username),
      retry: false,
      refetchOnWindowFocus: false,
    },
  })
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean | undefined>()
  const [localStorageKeyPrefix, setLocalStorageKeyPrefix] = useState<string | undefined>()
  const localStorageKey = useSafeUsernameStorageKey(localStorageKeyPrefix, username)

  // Build local storage prefix when invite data is ready.
  useEffect(() => {
    if (orgMemberQuery.data?.status === 200 && orgMemberQuery.data?.data.invite?.url) {
      // For the local storage key we include invite url (it has an id), because otherwise the banner would not appear
      // when user would leave one organization and join another (or rejoin the same one).
      setLocalStorageKeyPrefix(`kpiOrgInviteAcceptedBanner-${orgMemberQuery.data?.data.invite.url}`)
    }
  }, [orgMemberQuery.data?.status, (orgMemberQuery.data?.data as MemberListResponse)?.invite?.url])

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
    !organization.is_mmo ||
    // Only show banner to users who have accepted the invite
    orgMemberQuery.data?.status !== 200 ||
    orgMemberQuery.data?.data.invite?.status !== InviteStatusChoicesEnum.accepted ||
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
        ).replaceAll('##TEAM_OR_ORGANIZATION_NAME##', organization.name)}
      </Alert>
    </div>
  )
}
