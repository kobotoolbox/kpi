// Libraries
import React, {useEffect, useState} from 'react';
// Partial components
import Alert from 'js/components/common/alert';
// Stores, hooks and utilities
import {useOrganizationMemberDetailQuery} from 'jsapp/js/account/organization/membersQuery';
import {useOrganizationQuery} from '../organizationQuery';
// Constants and types
import {MemberInviteStatus} from 'js/account/organization//membersInviteQuery';

const LOCAL_STORAGE_PREFIX = 'kpiOrgInviteAcceptedBanner';

/**
 * Displays a banner to a user that has joined organization. It will be displayed indefinitely, until
 * user dismisses it with "x" button.
 *
 * Note: this is for a user that is part of an organization (and thus has access to it).
 */
export default function OrgInviteAcceptedBanner(props: {username: string}) {
  const organizationMemberDetailQuery = useOrganizationMemberDetailQuery(props.username, false);
  const orgQuery = useOrganizationQuery();
  const [wasPreviouslyDismissed, setWasPreviouslyDismissed] = useState<boolean>(false);
  const [localStorageKey, setLocalStorageKey] = useState('');

  /*
   * When this component is mounted, create the localstorage key we'll use to
   * store/check whether the dialog has been dismissed
   */
  useEffect(() => {
    (async () => {
      if (crypto.subtle) {
        // Let's avoid leaving behind an easily-accessible list of all users
        // who've logged in with this browser
        // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
        const encoder = new TextEncoder();
        const encoded = encoder.encode(props.username);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
        const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
        const hashHex = hashArray
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''); // convert bytes to hex string
        setLocalStorageKey(`${LOCAL_STORAGE_PREFIX}-${hashHex}`);
      } else {
        // `crypto.subtle` is only available in secure (https://) contexts
        setLocalStorageKey(
          `${LOCAL_STORAGE_PREFIX}-FOR DEVELOPMENT ONLY-${props.username}`
        );
      }
    })();
  }, []);

  /*
   * Show the dialog if we have a key to check and localStorage has an entry for this
   * user/feature combination, hide it otherwise
   */
  useEffect(() => {
    const bannerStatus = localStorageKey && localStorage.getItem(localStorageKey);
    setWasPreviouslyDismissed(!bannerStatus);
  }, [localStorageKey]);

  // Close the dialog box and store that we've closed it
  function handleCloseBanner() {
    localStorage.setItem(localStorageKey, 'dismissed');
    setWasPreviouslyDismissed(false);
  }

  // We are only interested in showing the banner if the invite has been accepted
  if (organizationMemberDetailQuery.data?.invite?.status !== MemberInviteStatus.accepted) {
    return null;
  }
  // Wait for data to be loaded
  if (orgQuery.data?.name === undefined) {
    return null;
  }

  if (!wasPreviouslyDismissed) {
    return null;
  }

  return (
    // We wrap it in a div to avoid flexbox squashing the content.
    <div>
      <Alert
        type='info'
        mt='md'
        ml='md'
        mr='md'
        iconName='information'
        withCloseButton
        onClose={handleCloseBanner}
      >
        {t(
          'This account is now managed by ##TEAM_OR_ORGANIZATION_NAME##. All projects previously owned by your ' +
          'account are currently being transfered and will be owned by ##TEAM_OR_ORGANIZATION_NAME##. This process ' +
          'can take up to a few minutes to complete.'
        ).replaceAll('##TEAM_OR_ORGANIZATION_NAME##', orgQuery.data.name)}
      </Alert>
    </div>
  );
}
