import React, { useState } from 'react'

import { Button, FocusTrap, Group, Modal, Stack, Text } from '@mantine/core'
import { getSimpleMMOLabel } from '#/account/organization/organization.utils'
import subscriptionStore from '#/account/subscriptionStore'
import type { ErrorDetail } from '#/api/models/errorDetail'
import type { InviteResponse } from '#/api/models/inviteResponse'
import { InviteStatusChoicesEnum } from '#/api/models/inviteStatusChoicesEnum'
import {
  useOrganizationsInvitesPartialUpdate,
  useOrganizationsInvitesRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import Alert from '#/components/common/alert'
import LoadingSpinner from '#/components/common/loadingSpinner'
import envStore from '#/envStore'
import { useSession } from '#/stores/useSession'
import { notify, sleep } from '#/utils'

/**
 * Displays a modal to a user that got an invitation for joining an organization. There is a possibility to accept or
 * decline it. Parent component is responsible for knowing if this is needed to be displayed.
 *
 * Note: this is for a user that is NOT a part of an organization (and thus has no access to it).
 */
export default function OrgInviteModal(props: { orgId: string; inviteId: string; onUserResponse: () => void }) {
  const [isModalOpen, setIsModalOpen] = useState(true)
  const session = useSession()

  // We use `mmoLabel` as fallback until `organization_name` is available at the endpoint
  const mmoLabel = getSimpleMMOLabel(envStore.data, subscriptionStore.activeSubscriptions[0])
  const orgInvitesQuery = useOrganizationsInvitesRetrieve(props.orgId, props.inviteId)
  const orgName = (orgInvitesQuery.data?.data as InviteResponse)?.organization_name ?? mmoLabel

  const [userResponseType, setUserResponseType] = useState<InviteStatusChoicesEnum | null>(null)
  const [miscError, setMiscError] = useState<string | undefined>()
  const [awaitingDataRefresh, setAwaitingDataRefresh] = useState(false)
  const orgInvitesPatch = useOrganizationsInvitesPartialUpdate({
    mutation: {
      onMutate: (variables) => {
        if (!('status' in variables.data)) return // just a typeguard, should never happen.
        setUserResponseType(variables.data.status)
      },
      onSuccess: async (_data, variables, _context) => {
        if (!('status' in variables.data)) return // just a typeguard, should never happen.

        if (variables.data.status === InviteStatusChoicesEnum.accepted) {
          setAwaitingDataRefresh(true)
          await sleep(1000) // Give it a second to allow for initial backend data transfers
          session.refreshAccount() // refresh session to refresh org data and project list
          notify(t('Invitation successfully accepted'))
        } else {
          notify(t('Invitation successfully declined'))
        }
        setUserResponseType(null)
        props.onUserResponse()
      },
      onError: (_error) => {
        setMiscError(t('Unknown error while trying to update an invitation')) // TODO: update message in backend (DEV-1218).
        setUserResponseType(null)
      },
    },
  })

  const handleDeclineInvite = async () => {
    orgInvitesPatch.mutate({
      uidOrganization: props.orgId,
      guid: props.inviteId,
      data: { status: InviteStatusChoicesEnum.declined },
    })
  }

  const handleAcceptInvite = async () => {
    orgInvitesPatch.mutate({
      uidOrganization: props.orgId,
      guid: props.inviteId,
      data: { status: InviteStatusChoicesEnum.accepted },
    })
  }

  const handleSignOut = () => {
    session.logOut()
  }

  let content: React.ReactNode = null
  let title: React.ReactNode = null

  // Case 1: loading data.
  if (orgInvitesQuery.isLoading) {
    content = <LoadingSpinner />
  }
  // Case 2: failed to get the invitation data from API.
  else if (orgInvitesQuery.isError) {
    title = t('Invitation not found')
    content = (
      <Alert type='error'>
        {orgInvitesQuery.error.detail ??
          t('Could not find invitation ##invite_id## from organization ##org_id##')
            .replace('##invite_id##', props.inviteId)
            .replace('##org_id##', props.orgId)}
      </Alert>
    )
  }
  // Case 3: failed to accept or decline invitation (API response).
  else if (orgInvitesPatch.isError) {
    title = t('Unable to join ##TEAM_OR_ORGANIZATION_NAME##').replace('##TEAM_OR_ORGANIZATION_NAME##', orgName)
    content = (
      <Stack>
        <Alert type='error'>
          {(orgInvitesPatch.error as ErrorDetail).detail ?? t('Failed to respond to invitation')}
        </Alert>

        <Group justify='flex-end'>
          <Button
            variant='light'
            size='lg'
            onClick={() => {
              setIsModalOpen(false)
            }}
          >
            {t('Cancel')}
          </Button>

          <Button variant='filled' size='lg' onClick={handleSignOut}>
            {t('Sign out')}
          </Button>
        </Group>
      </Stack>
    )
  }
  // Case 4: failed to accept or decline invitation (misc error)
  else if (miscError) {
    title = t('Unable to join ##TEAM_OR_ORGANIZATION_NAME##').replace('##TEAM_OR_ORGANIZATION_NAME##', orgName)
    content = <Alert type='error'>{miscError}</Alert>
  }
  // Case 3: got the invite, its status is pending, so we display form
  // We also continue displaying this content while we wait for data to refresh following acceptance
  else if (
    orgInvitesQuery.data?.status === 200 &&
    (orgInvitesQuery.data?.data.status === InviteStatusChoicesEnum.pending || awaitingDataRefresh)
  ) {
    title = t('Accept invitation to join ##TEAM_OR_ORGANIZATION_NAME##').replace(
      '##TEAM_OR_ORGANIZATION_NAME##',
      orgName,
    )
    content = (
      <Stack>
        <Text>
          {t(
            'When you accept this invitation, all of the submissions, data storage, and transcription and ' +
              'translation usage for all projects will be transferred to the ##TEAM_OR_ORGANIZATION##.',
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
            loading={userResponseType === InviteStatusChoicesEnum.declined}
          >
            {t('Decline')}
          </Button>

          <Button
            variant='filled'
            size='lg'
            onClick={handleAcceptInvite}
            // We don't use RQ loading state here because we also want spinner to display during
            // timeout while we give backend time for data transfer
            loading={userResponseType === InviteStatusChoicesEnum.accepted}
          >
            {t('Accept')}
          </Button>
        </Group>
      </Stack>
    )
  }
  // Case 4: got the invite, its status is something else, we display error message
  else if (orgInvitesQuery.data?.status === 200 && orgInvitesQuery.data?.data.status) {
    title = t('Unable to join ##TEAM_OR_ORGANIZATION_NAME##').replace('##TEAM_OR_ORGANIZATION_NAME##', orgName)
    content = <Alert type='error'>{t('This invitation is no longer available for a response')}</Alert>
  }
  // In any other case we simply display nothing (instead of empty modal)
  else {
    return null
  }

  return (
    <Modal opened={isModalOpen} onClose={() => setIsModalOpen(false)} title={title}>
      {/* We don't want "x" button to get focus (see https://mantine.dev/core/modal/#initial-focus) */}
      <FocusTrap.InitialFocus />
      {content}
    </Modal>
  )
}
