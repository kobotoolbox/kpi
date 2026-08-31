import type { ReactNode } from 'react'

import { Group, LoadingOverlay, Menu, Modal, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { InviteResponse } from '#/api/models/inviteResponse'
import { InviteStatusChoicesEnum } from '#/api/models/inviteStatusChoicesEnum'
import {
  useOrganizationsInvitesDestroy,
  useOrganizationsInvitesPartialUpdate,
} from '#/api/react-query/user-team-organization-usage'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import ButtonNew from '#/components/common/ButtonNew'
import { getAssetUIDFromUrl, notify } from '#/utils'

/**
 * A dropdown with all actions that can be taken towards an organization invitee.
 */
export default function InviteeActionsDropdown({
  target,
  invite,
}: {
  target: ReactNode
  invite: InviteResponse
}) {
  const [organization] = useOrganizationAssumed()

  const [opened, { open, close }] = useDisclosure()

  const orgInvitesPatch = useOrganizationsInvitesPartialUpdate({
    mutation: {
      onSuccess: () => notify(t('The invitation was resent'), 'success'),
    },
  })
  const orgInvitesDestroy = useOrganizationsInvitesDestroy({
    mutation: {
      onSuccess: () => notify(t('Invitation removed'), 'success'),
    },
  })

  const resendInvitation = () => {
    orgInvitesPatch.mutate({
      uidOrganization: organization.id,
      guid: getAssetUIDFromUrl(invite.url)!,
      data: {
        status: InviteStatusChoicesEnum.resent,
      },
    })
  }

  const showRemovalConfirmation = () => {
    open()
  }

  const removeInvitation = () => {
    orgInvitesDestroy.mutate({
      uidOrganization: organization.id,
      guid: getAssetUIDFromUrl(invite.url)!,
    })
  }

  return (
    <>
      <Modal opened={opened} onClose={close} title={t('Remove invitation?')}>
        <LoadingOverlay visible={orgInvitesDestroy.isPending} />
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

      <LoadingOverlay visible={orgInvitesPatch.isPending} />
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
