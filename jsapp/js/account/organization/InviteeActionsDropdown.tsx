import type { ReactNode } from 'react'

import { Group, LoadingOverlay, Menu, Modal, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import ButtonNew from '#/components/common/ButtonNew'
import { notify } from '#/utils'
import type { MemberInvite } from './membersInviteQuery'
import { MemberInviteStatus, usePatchMemberInvite, useRemoveMemberInvite } from './membersInviteQuery'

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
      await patchInviteMutation.mutateAsync({
        status: MemberInviteStatus.resent,
      })
      notify(t('The invitation was resent'), 'success')
    } catch (e: any) {
      if (e.status === 429 && e.headers?.get('Retry-After')) {
        const minutes = Math.ceil(Number.parseInt(e.headers.get('Retry-After')) / 60)
        notify(
          t('Invitation resent too quickly, wait for ##MINUTES## minutes before retrying').replace(
            '##MINUTES##',
            minutes.toString(),
          ),
          'error',
        )
        return
      }
      // Generic error handling is done in the api client
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
