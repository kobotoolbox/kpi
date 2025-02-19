// Libraries
import React, { useEffect, useState } from 'react'
// Partial components
import Alert from 'js/components/common/alert'
// Stores, hooks and utilities
import { useOrganizationMemberDetailQuery } from 'jsapp/js/account/organization/membersQuery'
import { useOrganizationQuery } from '../organizationQuery'
import { useSafeUsernameStorageKey } from 'jsapp/js/hooks/useSafeUsernameStorageKey'
// Constants and types
import { MemberInviteStatus } from 'js/account/organization//membersInviteQuery'

/**
 * Displays a banner to a user that has joined organization. It will be displayed indefinitely (until user dismisses it
 * with "x" button). Dismissal is being stored in `localStorage`.
 *
 * Note: this is for a user that is part of an organization (and thus has access to it).
 */
export default function OrgInviteAcceptedBanner(props: { username: string }) {
  const organizationMemberDetailQuery = useOrganizationMemberDetailQuery(props.username, false)
  const orgQuery = useOrganizationQuery()
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false)
  const localStorageKey = useSafeUsernameStorageKey('kpiOrgInviteAcceptedBanner', props.username)

  /*
   * Show the dialog if we have a key to check and localStorage has an entry for this
   * user/feature combination, hide it otherwise
   */
  useEffect(() => {
    const bannerStatus = localStorageKey && localStorage.getItem(localStorageKey)
    setIsBannerDismissed(!bannerStatus)
  }, [localStorageKey])

  // Close the dialog box and store that we've closed it
  function handleCloseBanner() {
    if (localStorageKey) {
      localStorage.setItem(localStorageKey, 'dismissed')
      setIsBannerDismissed(false)
    }
  }

  if (
    // Wait for data to be loaded
    orgQuery.data?.name === undefined ||
    // Only show banner to users who are members of MMO organization
    !orgQuery.data.is_mmo ||
    // Only show banner to users who have accepted the invite
    organizationMemberDetailQuery.data?.invite?.status !== MemberInviteStatus.accepted ||
    // Respect users who dismissed the banner
    !isBannerDismissed
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
        ).replaceAll('##TEAM_OR_ORGANIZATION_NAME##', orgQuery.data.name)}
      </Alert>
    </div>
  )
}
