// Libraries
import React, {useState} from 'react';
// Partial components
import Alert from 'js/components/common/alert';
import {Modal, Button, Stack, Text, Group} from '@mantine/core';
import LoadingSpinner from 'jsapp/js/components/common/loadingSpinner';
// Stores, hooks and utilities
import {
  MemberInviteStatus,
  useOrgMemberInviteQuery,
  usePatchMemberInvite
} from 'js/account/organization/membersInviteQuery';
import {getSimpleMMOLabel} from 'js/account/organization/organization.utils';
import envStore from 'jsapp/js/envStore';
import subscriptionStore from 'jsapp/js/account/subscriptionStore';
import {notify} from 'jsapp/js/utils';
// Constants and types
import {endpoints} from 'jsapp/js/api.endpoints';

/**
 * Displays a modal to a user that got an invitation for joining an organization. There is a possibility to accept or
 * decline it. Parent component is responsible for knowing if this is needed to be displayed.
 *
 * Note: this is for a user that is NOT a part of an organization (and thus has no access to it).
 */
export default function OrgInviteModal(props: {orgId: string; inviteId: string}) {
  const inviteUrl = endpoints.ORG_MEMBER_INVITE_DETAIL_URL
    .replace(':organization_id', props.orgId)
    .replace(':invite_id', props.inviteId);

  const [isModalOpen, setIsModalOpen] = useState(true);
  const orgMemberInviteQuery = useOrgMemberInviteQuery(props.orgId, props.inviteId);
  const patchMemberInvite = usePatchMemberInvite(inviteUrl)

  const mmoLabel = getSimpleMMOLabel(envStore.data, subscriptionStore.activeSubscriptions[0]);

  // We use `mmoLabel` as fallback until `organization_name` is available at the endpoint
  const orgName = orgMemberInviteQuery.data?.organization_name || mmoLabel;

  const handleDeclineInvite = async () => {
    try {
      await patchMemberInvite.mutateAsync({status: MemberInviteStatus.declined});
      setIsModalOpen(false);
      notify(t('Invitation successfully declined'));
    } catch (error) {
      notify(t('Failed to decline the invitation'), 'error');
    }
  };

  const handleAcceptInvite = async () => {
    try {
      await patchMemberInvite.mutateAsync({status: MemberInviteStatus.accepted});
      setIsModalOpen(false);
      notify(t('Invitation successfully accepted'));
    } catch (error) {
      notify(t('Failed to accept the invitation'), 'error');
    }
  };

  let content: React.ReactNode = null;
  let title: React.ReactNode = null;

  // Case 1: loading data
  if (orgMemberInviteQuery.isLoading) {
    content = <LoadingSpinner />;
  }
  // Case 2: failed to get the invite
  else if (orgMemberInviteQuery.isError) {
    title = t('Unable to join ##TEAM_OR_ORGANIZATION_NAME##').replace('##TEAM_OR_ORGANIZATION_NAME##', orgName)
    content = (
      <Alert type='error'>
        {
          t('Could not find invitation ##invite_id## from organization ##org_id##')
            .replace('##invite_id##', props.inviteId)
            .replace('##org_id##', props.orgId)
        }
      </Alert>
    );
  }
  // Case 3: got the invite, its status is pending, so we display form
  else if (orgMemberInviteQuery.data?.status === MemberInviteStatus.pending) {
    title = t('Accept invitation to join ##TEAM_OR_ORGANIZATION_NAME##')
      .replace('##TEAM_OR_ORGANIZATION_NAME##', orgName)
    content = (
      <Stack>
        <Text>
          {t(
            'When you accept this invitation, all of the submissions, data storage, and transcription and ' +
            'translation usage for all projects will be transferred to the ##TEAM_OR_ORGANIZATION##.'
          ).replace('##TEAM_OR_ORGANIZATION##', mmoLabel)}
        </Text>

        <Alert type='info' iconName='information'>
          {t('Note: Once you accept, transfer might take a few minutes to complete.')}
        </Alert>

        <Group justify='flex-end'>
          <Button
            variant='light'
            size='lg'
            onClick={handleDeclineInvite}
            loading={patchMemberInvite.isPending}
          >{t('Decline')}</Button>

          <Button
            variant='filled'
            size='lg'
            onClick={handleAcceptInvite}
            loading={patchMemberInvite.isPending}
          >{t('Accept')}</Button>
        </Group>
      </Stack>
    );
  }
  // Case 4: got the invite, its status is something else, we display error message
  else if (orgMemberInviteQuery.data?.status) {
    title = t('Unable to join ##TEAM_OR_ORGANIZATION_NAME##').replace('##TEAM_OR_ORGANIZATION_NAME##', orgName)
    content = <Alert type='error'>{t('This invitation is no longer available for a response')}</Alert>;
  }
  // In any other case we simply display nothing (instead of empty modal)
  else {
    return null;
  }

  return (
    <Modal
      opened={isModalOpen}
      onClose={() => {setIsModalOpen(false);}}
      title={title}
    >
      {content}
    </Modal>
  );
};
