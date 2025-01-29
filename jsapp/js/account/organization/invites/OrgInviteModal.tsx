// Libraries
import React, {useState} from 'react';

// Partial components
import {Modal} from '@mantine/core';
import Alert from 'js/components/common/alert';
import LoadingSpinner from 'jsapp/js/components/common/loadingSpinner';

// Stores, hooks and utilities
import {MemberInviteStatus, useOrgMemberInviteQuery} from 'js/account/organization/membersInviteQuery';
// Constants and types
// Styles

export default function OrgInviteModal(props: {orgId: string; inviteId: string}) {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const orgMemberInviteQuery = useOrgMemberInviteQuery(props.orgId, props.inviteId);

  let content: React.ReactNode = null;

  if (orgMemberInviteQuery.isError) {
    content = (
      <Alert type='error'>
        {
          t('Could not find invite ##invite_id## from organization ##org_id##')
            .replace('##invite_id##', props.inviteId)
            .replace('##org_id##', props.orgId)
        }
      </Alert>
    );
  } else if (orgMemberInviteQuery.isLoading) {
    content = <LoadingSpinner />;
  } else if (orgMemberInviteQuery.data?.status === MemberInviteStatus.pending) {
    content = (
      <div>
        <p>You have been invited</p>
      </div>
    );
  }

  return (
    <Modal
      opened={isModalOpen}
      onClose={() => {setIsModalOpen(false);}}
      title={t('Organization Invite')}
    >
      {content}
    </Modal>
  );
};
