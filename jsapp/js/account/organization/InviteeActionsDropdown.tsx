import {Modal, Stack, Group, Text, Menu, LoadingOverlay} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';
import ButtonNew from 'jsapp/js/components/common/ButtonNew';
import type {ReactNode} from 'react';
import type {MemberInvite} from './membersInviteQuery';
import {usePatchMemberInvite, useRemoveMemberInvite} from './membersInviteQuery';
import {notify} from 'alertifyjs';

/**
 * A dropdown with all actions that can be taken towards an organization invitee.
 */
export default function InviteeActionsDropdown({
  target,
  invite,
}: {
  target: ReactNode;
  invite: MemberInvite;
}) {
  const [opened, {open, close}] = useDisclosure();

  const patchInviteMutation = usePatchMemberInvite(invite.url);
  const removeInviteMutation = useRemoveMemberInvite();

  const handleResendInvitationAction = async () => {
    await patchInviteMutation.mutateAsync(invite);
  };

  const handleRemoveInvitationAction = () => {
    open();
  };

  const handleRemoveInvitation = async () => {
    // console.log(invite)
    try {
      await removeInviteMutation.mutateAsync(invite.url);
      notify(t('Invitation removed'), 'success');
    } catch (e) {
      notify(t('An error occurred while removing the invitation'), 'error');
    } finally {
      close();
    }
  };

  return (
    <>
      <Modal opened={opened} onClose={close} title={t('Remove invitation?')}>
        <LoadingOverlay visible={removeInviteMutation.isPending} />
        <Stack>
          <Text>
            {t(
              "Are you sure you want to remove this user's invitation to join the team?"
            )}
          </Text>
          <Group justify='flex-end'>
            <ButtonNew size='md' onClick={close}>
              {t('Cancel')}
            </ButtonNew>
            <ButtonNew
              size='md'
              onClick={handleRemoveInvitation}
              variant='danger'
            >
              {t('Remove invitation')}
            </ButtonNew>
          </Group>
        </Stack>
      </Modal>

      <Menu offset={0} position='bottom-end'>
        <Menu.Target>{target}</Menu.Target>

        <Menu.Dropdown>
          <Menu.Item onClick={handleResendInvitationAction}>
            {t('Resend invitation')}
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item variant='danger' onClick={handleRemoveInvitationAction}>
            {t('Remove invitation')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
}
