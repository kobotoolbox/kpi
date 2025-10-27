import React, { useState } from 'react'

import { Button, FocusTrap, Group, Modal, Stack, Text } from '@mantine/core'
import { getSimpleMMOLabel } from '#/account/organization/organization.utils'
import subscriptionStore from '#/account/subscriptionStore'
import type { ErrorDetail } from '#/api/models/errorDetail'
import { InviteStatusChoicesEnum } from '#/api/models/inviteStatusChoicesEnum'
import {
  useOrganizationsInvitesPartialUpdate,
  useOrganizationsInvitesRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import Alert from '#/components/common/alert'
import LoadingSpinner from '#/components/common/loadingSpinner'
import envStore from '#/envStore'
import { useSession } from '#/stores/useSession'
import { notify } from '#/utils'

/**
 * Displays a modal to a user that got an invitation for joining an organization. There is a possibility to accept or
 * decline it. Parent component is responsible for knowing if this is needed to be displayed.
 *
 * Note: this is for a user that is NOT a part of an organization (and thus has no access to it).
 */
export default function OrgInviteModal(props: { orgId: string; inviteId: string; onUserResponse: () => void }) {
  const [isModalOpen, setIsModalOpen] = useState(true)
  const [awaitingDataRefresh, setAwaitingDataRefresh] = useState(false)
  const [userResponseType, setUserResponseType] = useState<InviteStatusChoicesEnum | null>(null)
  const session = useSession()
  const orgInvitesQuery = useOrganizationsInvitesRetrieve(props.orgId, props.inviteId)
  const orgInvitesPatch = useOrganizationsInvitesPartialUpdate({
    request: {
      notifyAboutError: false,
    },
  })
  const handleOrgInvitesPatch = (status: InviteStatusChoicesEnum) => {
    return orgInvitesPatch.mutateAsync({ uidOrganization: props.orgId, guid: props.inviteId, data: { status } })
  }
  // We handle all the errors through query and BE responses, but for some edge cases we have this:
  const [miscError, setMiscError] = useState<string | undefined>()

  const mmoLabel = getSimpleMMOLabel(envStore.data, subscriptionStore.activeSubscriptions[0])

  // We use `mmoLabel` as fallback until `organization_name` is available at the endpoint
  const orgName = (orgInvitesQuery.data?.data as InviteResponse)?.organization_name ?? mmoLabel

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  async function handleSuccessfulInviteResponse(message: string, refreshData = false) {
    // After a one-second delay to allow for initial backend data transfers,
    // refresh session to refresh org data and project list
    if (refreshData) {
      setAwaitingDataRefresh(true)
      await wait(1000)
      session.refreshAccount()
    }
    props.onUserResponse()
    notify(message)
  }

  const handleDeclineInvite = async () => {
    try {
      setUserResponseType(InviteStatusChoicesEnum.declined)
      await handleOrgInvitesPatch(InviteStatusChoicesEnum.declined)
      handleSuccessfulInviteResponse(t('Invitation successfully declined'))
    } catch (error) {
      setMiscError(t('Unknown error while trying to update an invitation'))
      setUserResponseType(null)
    }
  }

  const handleAcceptInvite = async () => {
    try {
      setUserResponseType(InviteStatusChoicesEnum.accepted)
      await handleOrgInvitesPatch(InviteStatusChoicesEnum.accepted)
      await handleSuccessfulInviteResponse(t('Invitation successfully accepted'), true)
    } catch (error) {
      setMiscError(t('Unknown error while trying to update an invitation'))
      setUserResponseType(null)
    }
  }

  const handleSignOut = () => {
    session.logOut()
  }

  let content: React.ReactNode = null
  let title: React.ReactNode = null

  // TODO: investigate the error flows!

  // Case 1: loading data.
  if (orgInvitesQuery.isLoading) {
    content = <LoadingSpinner />
  }
  // Case 2: failed to get the invitation data from API.
  else if (orgInvitesQuery.isError) {
    title = t('Invitation not found')
    // Fallback message
    let memberInviteErrorMessage = t('Could not find invitation ##invite_id## from organization ##org_id##')
      .replace('##invite_id##', props.inviteId)
      .replace('##org_id##', props.orgId)
    if (orgInvitesQuery.error?.detail) {
      memberInviteErrorMessage = orgInvitesQuery.error.detail as string
    }
    content = <Alert type='error'>{memberInviteErrorMessage}</Alert>
  }
  // Case 3: failed to accept or decline invitation (API response).
  else if (orgInvitesPatch.isError) {
    title = t('Unable to join ##TEAM_OR_ORGANIZATION_NAME##').replace('##TEAM_OR_ORGANIZATION_NAME##', orgName)
    // Fallback message
    let patchMemberInviteErrorMessage = t('Failed to respond to invitation')
    // TODO: sort out types
    if ((orgInvitesPatch.error as ErrorDetail)?.detail) {
      patchMemberInviteErrorMessage = (orgInvitesPatch.error as ErrorDetail).detail
    }
    content = (
      <Stack>
        <Alert type='error'>{patchMemberInviteErrorMessage}</Alert>

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
    <Modal
      opened={isModalOpen}
      onClose={() => {
        setIsModalOpen(false)
      }}
      title={title}
    >
      {/* We don't want "x" button to get focus (see https://mantine.dev/core/modal/#initial-focus) */}
      <FocusTrap.InitialFocus />
      {content}
    </Modal>
  )
}
