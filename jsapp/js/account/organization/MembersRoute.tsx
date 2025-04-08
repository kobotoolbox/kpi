import React from 'react'

import { Box, Divider, Group, Stack, Text, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import InviteModal from '#/account/organization/InviteModal'
import { getSimpleMMOLabel } from '#/account/organization/organization.utils'
import subscriptionStore from '#/account/subscriptionStore'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import Avatar from '#/components/common/avatar'
import Badge from '#/components/common/badge'
import LoadingSpinner from '#/components/common/loadingSpinner'
import envStore from '#/envStore'
import PaginatedQueryUniversalTable from '#/universalTable/paginatedQueryUniversalTable.component'
import type { UniversalTableColumn } from '#/universalTable/universalTable.component'
import { formatDate } from '#/utils'
import InviteeActionsDropdown from './InviteeActionsDropdown'
import MemberActionsDropdown from './MemberActionsDropdown'
import MemberRoleSelector from './MemberRoleSelector'
import useOrganizationMembersQuery from './membersQuery'
import type { OrganizationMember, OrganizationMemberListItem } from './membersQuery'
import styles from './membersRoute.module.scss'
import { OrganizationUserRole, useOrganizationQuery } from './organizationQuery'

export default function MembersRoute() {
  const orgQuery = useOrganizationQuery()
  const [opened, { open, close }] = useDisclosure(false)
  const mmoLabel = getSimpleMMOLabel(envStore.data, subscriptionStore.activeSubscriptions[0])

  /**
   * Checks whether object should be treated as organization member or invitee.
   * Returns both an invite and member, but one of these will be null depending on status
   */
  function getMemberOrInviteDetails(obj: OrganizationMemberListItem) {
    const invite = obj.invite?.status === 'pending' || obj.invite?.status === 'resent' ? obj.invite : null
    const member = invite ? null : ({ ...obj } as OrganizationMember)
    return { invite, member }
  }

  if (!orgQuery.data) {
    return <LoadingSpinner />
  }

  const columns: Array<UniversalTableColumn<OrganizationMemberListItem>> = [
    {
      key: 'user__extra_details__name',
      label: t('Name'),
      cellFormatter: (obj: OrganizationMemberListItem) => {
        const { invite, member } = getMemberOrInviteDetails(obj)
        return (
          <Avatar
            size='m'
            username={member ? member.user__username : invite!.invitee}
            isUsernameVisible
            email={member ? member.user__email : undefined}
            // We pass `undefined` for the case it's an empty string
            fullName={invite ? undefined : member?.user__extra_details__name || undefined}
            isEmpty={!member}
          />
        )
      },
      size: 360,
    },
    {
      key: 'invite',
      label: t('Status'),
      size: 120,
      cellFormatter: (obj: OrganizationMemberListItem) => {
        const { invite, member } = getMemberOrInviteDetails(obj)
        if (invite) {
          return <Badge color='light-blue' size='s' label={t('Invited')} />
        } else {
          return <Badge color='light-green' size='s' label={t('Active')} />
        }
      },
    },
    {
      key: 'date_joined',
      label: t('Date added'),
      size: 140,
      cellFormatter: (obj: OrganizationMemberListItem) => {
        const { invite, member } = getMemberOrInviteDetails(obj)
        return invite ? formatDate(invite.date_created) : formatDate(member!.date_joined)
      },
    },
    {
      key: 'role',
      label: t('Role'),
      size: 140,
      cellFormatter: (obj: OrganizationMemberListItem) => {
        const { invite, member } = getMemberOrInviteDetails(obj)
        if (
          member?.role === OrganizationUserRole.owner ||
          !['owner', 'admin'].includes(orgQuery.data.request_user_role)
        ) {
          // If the member is the Owner or
          // If the user is not an owner or admin, we don't show the selector
          switch (member?.role || invite?.invitee_role) {
            case OrganizationUserRole.owner:
              return t('Owner')
            case OrganizationUserRole.admin:
              return t('Admin')
            case OrganizationUserRole.member:
              return t('Member')
            default:
              return t('Unknown')
          }
        }
        if (invite) {
          return (
            <MemberRoleSelector
              username={invite.invitee}
              role={invite.invitee_role}
              currentUserRole={orgQuery.data.request_user_role}
              inviteUrl={invite.url}
            />
          )
        }
        return (
          <MemberRoleSelector
            username={member!.user__username}
            role={member!.role}
            currentUserRole={orgQuery.data.request_user_role}
          />
        )
      },
    },
    {
      key: 'user__has_mfa_enabled',
      label: t('2FA'),
      size: 90,
      cellFormatter: (obj: OrganizationMemberListItem) => {
        const { invite, member } = getMemberOrInviteDetails(obj)
        if (member) {
          if (member.user__has_mfa_enabled) {
            return <Badge size='s' color='light-blue' icon='check' />
          }
          return <Badge size='s' color='light-storm' icon='minus' />
        }
        return
      },
    },
  ]

  // Actions column is only for owner and admins.
  if (
    orgQuery.data.request_user_role === OrganizationUserRole.admin ||
    orgQuery.data.request_user_role === OrganizationUserRole.owner
  ) {
    columns.push({
      key: 'url',
      label: '',
      size: 64,
      isPinned: 'right',
      cellFormatter: (obj: OrganizationMemberListItem) => {
        const { invite, member } = getMemberOrInviteDetails(obj)
        // There is no action that can be done on an owner
        if (member?.role === OrganizationUserRole.owner) {
          return null
        }

        const target = <ActionIcon variant='transparent' size='md' iconName='more' />

        if (member) {
          return (
            <MemberActionsDropdown
              target={target}
              targetUsername={member?.user__username ?? invite!.invitee}
              currentUserRole={orgQuery.data.request_user_role}
            />
          )
        } else if (invite) {
          return <InviteeActionsDropdown target={target} invite={invite} />
        }

        return null
      },
    })
  }

  return (
    <div className={styles.membersRouteRoot}>
      <header className={styles.header}>
        <h2 className={styles.headerText}>{t('Members')}</h2>
      </header>

      {!(orgQuery.data.request_user_role === 'member') && (
        <Box>
          <Divider />
          <Group w='100%' justify='space-between'>
            <Stack gap='xs' pt='xs' pb='xs'>
              {/*TODO: 'Roboto' font is not loading correctly. The styling matches the figma but still looks off.*/}
              <Title fw={600} order={5}>
                {t('Invite members')}
              </Title>
              <Text>
                {t(
                  'Invite more people to join your ##TEAM_OR_ORGANIZATION## or change their role permissions below.',
                ).replace('##TEAM_OR_ORGANIZATION##', mmoLabel)}
              </Text>
            </Stack>

            <Box>
              <ButtonNew size='lg' onClick={open}>
                {t('Invite members')}
              </ButtonNew>
              <InviteModal opened={opened} onClose={close} />
            </Box>
          </Group>
          <Divider mb='md' />
        </Box>
      )}

      <PaginatedQueryUniversalTable<OrganizationMemberListItem>
        queryHook={useOrganizationMembersQuery}
        columns={columns}
      />
    </div>
  )
}
