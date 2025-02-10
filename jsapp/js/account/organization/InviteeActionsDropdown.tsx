import { Modal, Stack, Group, Text, Menu, LoadingOverlay } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import ButtonNew from 'jsapp/js/components/common/ButtonNew'
import type { ReactNode } from 'react'
import type { MemberInvite } from './membersInviteQuery'
import { MemberInviteStatus, usePatchMemberInvite, useRemoveMemberInvite } from './membersInviteQuery'
import { notify } from 'alertifyjs'

/**
 * A dropdown with all actions that can be taken towards an organization invitee.
 */
export default function InviteeActionsDropdown({
  target,
  invite,
}: {
  target: ReactNode
  invite: MemberInvite
}) {
  const [opened, { open, close }] = useDisclosure()

  const patchInviteMutation = usePatchMemberInvite(invite.url)
  const removeInviteMutation = useRemoveMemberInvite()

  const resendInvitation = async () => {
    try {
      await patchInviteMutation.mutateAsync({ status: MemberInviteStatus.resent })
      notify(t('The invitation was resent'), 'success')
    } catch (e: any) {
      if (e.responseText) {
        const responseData = JSON.parse(e.responseText)
        console.log(e.responseText, responseData)
        notify(responseData.status.join(' '), 'error')
        return
      }
      notify(t('An error occurred while resending the invitation'), 'error')
    }
  }

  const showRemovalConfirmation = () => {
    open()
  }

  const removeInvitation = async () => {
    try {
      await removeInviteMutation.mutateAsync(invite.url)
      notify(t('Invitation removed'), 'success')
    } catch (e) {
      notify(t('An error occurred while removing the invitation'), 'error')
    } finally {
      close()
    }
  }

  return (
    <>
      <Modal opened={opened} onClose={close} title={t('Remove invitation?')}>
        <LoadingOverlay visible={removeInviteMutation.isPending} />
        <Stack>
          <Text>{t("Are you sure you want to remove this user's invitation to join the team?")}</Text>
          <Group justify='flex-end'>
            <ButtonNew size='md' onClick={close}>
              {t('Cancel')}
            </ButtonNew>
            <ButtonNew size='md' onClick={removeInvitation} variant='danger'>
              {t('Remove invitation')}
            </ButtonNew>
          </Group>
        </Stack>
      </Modal>

      <LoadingOverlay visible={patchInviteMutation.isPending} />
      <Menu offset={0} position='bottom-end'>
        <Menu.Target>{target}</Menu.Target>

        <Menu.Dropdown>
          <Menu.Item onClick={resendInvitation}>{t('Resend invitation')}</Menu.Item>
          <Menu.Divider />
          <Menu.Item variant='danger' onClick={showRemovalConfirmation}>
            {t('Remove invitation')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  )
}
