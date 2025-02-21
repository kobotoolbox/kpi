// Libraries
import React, { useState } from 'react'
// Partial components
import Alert from 'js/components/common/alert'
import { Modal, Button, Stack, Text, Group, FocusTrap } from '@mantine/core'
import LoadingSpinner from 'jsapp/js/components/common/loadingSpinner'
// Stores, hooks and utilities
import {
  MemberInviteStatus,
  useOrgMemberInviteQuery,
  usePatchMemberInvite,
} from 'js/account/organization/membersInviteQuery'
import { getSimpleMMOLabel } from 'js/account/organization/organization.utils'
import envStore from 'jsapp/js/envStore'
import subscriptionStore from 'jsapp/js/account/subscriptionStore'
import { notify } from 'jsapp/js/utils'
import { useSession } from 'jsapp/js/stores/useSession'
// Constants and types
import { endpoints } from 'jsapp/js/api.endpoints'

/**
 * Displays a modal to a user that got an invitation for joining an organization. There is a possibility to accept or
 * decline it. Parent component is responsible for knowing if this is needed to be displayed.
 *
 * Note: this is for a user that is NOT a part of an organization (and thus has no access to it).
 */
export default function OrgInviteModal(props: { orgId: string; inviteId: string; onUserResponse: () => void }) {
  const inviteUrl = endpoints.ORG_MEMBER_INVITE_DETAIL_URL.replace(':organization_id', props.orgId).replace(
    ':invite_id',
    props.inviteId,
  )

  const [isModalOpen, setIsModalOpen] = useState(true)
  const [awaitingDataRefresh, setAwaitingDataRefresh] = useState(false)
  const [userResponseType, setUserResponseType] = useState<MemberInviteStatus | null>(null)
  const session = useSession()
  const orgMemberInviteQuery = useOrgMemberInviteQuery(props.orgId, props.inviteId, false)
  const patchMemberInvite = usePatchMemberInvite(inviteUrl, false)
  // We handle all the errors through query and BE responses, but for some edge cases we have this:
  const [miscError, setMiscError] = useState<string | undefined>()

  const mmoLabel = getSimpleMMOLabel(envStore.data, subscriptionStore.activeSubscriptions[0])

  // We use `mmoLabel` as fallback until `organization_name` is available at the endpoint
  const orgName = orgMemberInviteQuery.data?.organization_name || mmoLabel

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  async function handleSuccessfulInviteResponse(message: string, refreshData: boolean = false) {
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
      setUserResponseType(MemberInviteStatus.declined)
      await patchMemberInvite.mutateAsync({ status: MemberInviteStatus.declined })
      handleSuccessfulInviteResponse(t('Invitation successfully declined'))
    } catch (error) {
      setMiscError(t('Unknown error while trying to update an invitation'))
      setUserResponseType(null)
    }
  }

  const handleAcceptInvite = async () => {
    try {
      setUserResponseType(MemberInviteStatus.accepted)
      await patchMemberInvite.mutateAsync({ status: MemberInviteStatus.accepted })
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

  // Case 1: loading data.
  if (orgMemberInviteQuery.isLoading || awaitingDataRefresh) {
    content = <LoadingSpinner />
  }
  // Case 2: failed to get the invitation data from API.
  else if (orgMemberInviteQuery.isError) {
    title = t('Invitation not found')
    // Fallback message
    let memberInviteErrorMessage = t('Could not find invitation ##invite_id## from organization ##org_id##')
      .replace('##invite_id##', props.inviteId)
      .replace('##org_id##', props.orgId)
    if (orgMemberInviteQuery.error?.responseJSON?.detail) {
      memberInviteErrorMessage = orgMemberInviteQuery.error.responseJSON.detail
    }
    content = <Alert type='error'>{memberInviteErrorMessage}</Alert>
  }
  // Case 3: failed to accept or decline invitation (API response).
  else if (patchMemberInvite.isError) {
    title = t('Unable to join ##TEAM_OR_ORGANIZATION_NAME##').replace('##TEAM_OR_ORGANIZATION_NAME##', orgName)
    // Fallback message
    let patchMemberInviteErrorMessage = t('Failed to respond to invitation')
    if (patchMemberInvite.error?.responseJSON?.detail) {
      patchMemberInviteErrorMessage = patchMemberInvite.error.responseJSON.detail
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
  else if (orgMemberInviteQuery.data?.status === MemberInviteStatus.pending) {
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
            loading={userResponseType === MemberInviteStatus.declined && patchMemberInvite.isPending}
          >
            {t('Decline')}
          </Button>

          <Button
            variant='filled'
            size='lg'
            onClick={handleAcceptInvite}
            loading={userResponseType === MemberInviteStatus.accepted && patchMemberInvite.isPending}
          >
            {t('Accept')}
          </Button>
        </Group>
      </Stack>
    )
  }
  // Case 4: got the invite, its status is something else, we display error message
  else if (orgMemberInviteQuery.data?.status) {
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
