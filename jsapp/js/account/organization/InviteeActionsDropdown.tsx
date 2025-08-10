import type { ReactNode } from 'react'

import { Group, LoadingOverlay, Menu, Modal, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { InviteResponse } from '#/api/models/inviteResponse'
import { InviteStatusChoicesEnum } from '#/api/models/inviteStatusChoicesEnum'
import {
  getOrganizationsInvitesListQueryKey,
  getOrganizationsInvitesRetrieveQueryKey,
  useOrganizationsInvitesDestroy,
  useOrganizationsInvitesPartialUpdate,
} from '#/api/react-query/organization-invites'
import ButtonNew from '#/components/common/ButtonNew'
import { queryClient } from '#/query/queryClient'
import { QueryKeys } from '#/query/queryKeys'
import { notify } from '#/utils'
import { inviteGuidFromUrl } from './common'
import { useOrganizationQuery } from './organizationQuery'

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
  const orgQuery = useOrganizationQuery()
  const organizationId = orgQuery.data?.id

  const [opened, { open, close }] = useDisclosure()

  const orgInvitesPatchMutation = useOrganizationsInvitesPartialUpdate({
    mutation: {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: getOrganizationsInvitesListQueryKey(variables.organizationId) })
        queryClient.invalidateQueries({
          queryKey: getOrganizationsInvitesRetrieveQueryKey(variables.organizationId, variables.guid),
        })
        queryClient.invalidateQueries({ queryKey: [QueryKeys.organizationMembers] })
        queryClient.invalidateQueries({ queryKey: [QueryKeys.organizationMemberDetail] })
      },
    },
    request: {
      errorMessageDisplay: t('There was an error updating this invitation.'),
    },
  })
  const orgInvitesDestroyMutation = useOrganizationsInvitesDestroy({
    mutation: {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: getOrganizationsInvitesListQueryKey(variables.organizationId) })
        queryClient.invalidateQueries({
          queryKey: getOrganizationsInvitesRetrieveQueryKey(variables.organizationId, variables.guid),
        })
        queryClient.invalidateQueries({ queryKey: [QueryKeys.organizationMembers] })
        queryClient.invalidateQueries({ queryKey: [QueryKeys.organizationMemberDetail] })
      },
    },
  })

  const resendInvitation = async () => {
    if (!organizationId) return
    try {
      await orgInvitesPatchMutation.mutateAsync({
        organizationId,
        guid: inviteGuidFromUrl(invite.url),
        data: {
          status: InviteStatusChoicesEnum.resent,
        },
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
    if (!organizationId) return
    try {
      await orgInvitesDestroyMutation.mutateAsync({ organizationId, guid: inviteGuidFromUrl(invite.url) })
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
        <LoadingOverlay visible={orgInvitesDestroyMutation.isPending} />
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

      <LoadingOverlay visible={orgInvitesPatchMutation.isPending} />
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
