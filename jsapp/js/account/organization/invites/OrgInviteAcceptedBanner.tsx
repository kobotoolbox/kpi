// Libraries
import React from 'react';
// Partial components
import Alert from 'js/components/common/alert';
// Stores, hooks and utilities
import {useOrganizationMemberDetailQuery} from 'jsapp/js/account/organization/membersQuery';
import { replaceBracketsWithLink } from 'jsapp/js/textUtils';
import { useOrganizationQuery } from '../organizationQuery';
// Constants and types
import {MemberInviteStatus} from 'js/account/organization//membersInviteQuery';

const INVITE_HELP_URL = 'TODO: Add URL here';

export default function OrgInviteAcceptedBanner(props: {orgId: string; username: string}) {
  const organizationMemberDetailQuery = useOrganizationMemberDetailQuery(props.orgId, props.username);
  const orgQuery = useOrganizationQuery();

  // We are only interested in showing the banner if the invite has been accepted
  if (organizationMemberDetailQuery.data?.invite?.status !== MemberInviteStatus.accepted) {
    return null;
  }
  // Wait for data to be loaded
  if (orgQuery.data?.name === undefined) {
    return null;
  }

  return (
    // We wrap it in a div to avoid flexbox squashing the content.
    <div>
    <Alert type='info' mt='md' ml='md' mr='md' iconName='information'>
      <span
      dangerouslySetInnerHTML={{
        __html: replaceBracketsWithLink(
          t(
            'This account is now managed by ##TEAM_OR_ORGANIZATION_NAME##. All projects previously owned by your account ' +
            'are currently being transfered and will be owned by ##TEAM_OR_ORGANIZATION_NAME##. This process can take up ' +
            'to a few minutes to complete. Learn more about teams [here].'
          ).replaceAll('##TEAM_OR_ORGANIZATION_NAME##', orgQuery.data.name),
          INVITE_HELP_URL
        ),
      }}
      />
    </Alert>
    </div>
  );
}
