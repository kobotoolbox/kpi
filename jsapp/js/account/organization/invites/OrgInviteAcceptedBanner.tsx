// Libraries
import React from 'react';
// Partial components
import {Alert} from '@mantine/core';
// Stores, hooks and utilities
import {useSession} from 'js/stores/useSession';
import {useOrganizationMemberDetailQuery} from 'js/account/organization/membersQuery';
// Constants and types
// Styles

export default function OrgInviteAcceptedBanner(props: {orgId: string, username: string}) {
  const session = useSession();
  const organizationMemberDetailQuery = useOrganizationMemberDetailQuery(orgId, username);

  const hasPendingInvite = membersData?.some(
    (member) => member.email === user.email && member.status === 'pending'
  );

  // Wait for session
  if (!session.currentLoggedAccount?.username) {
    return null;
  }

  if (!hasPendingInvite) {
    return null;
  }

  return (
    <Alert title="Invite Pending" color="yellow">
      You have a pending invite to join the organization. Please check your email for further instructions.
    </Alert>
  );
};
