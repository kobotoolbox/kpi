import React, { useState } from 'react'

import { Box, Divider, Group, Stack, Text, Title, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { keepPreviousData } from '@tanstack/react-query'
import { observer } from 'mobx-react-lite'
import UniversalTable, { DEFAULT_PAGE_SIZE, type UniversalTableColumn } from '#/UniversalTable'
import InviteModal from '#/account/organization/InviteModal'
import { getSimpleMMOLabel } from '#/account/organization/organization.utils'
import { isSsoAvailable } from '#/account/security/sso/sso.utils'
import subscriptionStore from '#/account/subscriptionStore'
import type { ErrorDetail } from '#/api/models/errorDetail'
import { InviteStatusChoicesEnum } from '#/api/models/inviteStatusChoicesEnum'
import type { MemberListResponse } from '#/api/models/memberListResponse'
import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import type { OrganizationsMembersListParams } from '#/api/models/organizationsMembersListParams'
import {
  getOrganizationsMembersListQueryKey,
  useOrganizationsMembersList,
} from '#/api/react-query/user-team-organization-usage'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import Avatar from '#/components/common/avatar'
import Badge from '#/components/common/badge'
import envStore from '#/envStore'
import SortableProjectColumnHeader, {
  type SortableColumnOrder,
} from '#/projects/projectsTable/sortableProjectColumnHeader'
import { formatDate } from '#/utils'
import InviteeActionsDropdown from './InviteeActionsDropdown'
import MemberActionsDropdown from './MemberActionsDropdown'
import MemberRoleSelector from './MemberRoleSelector'
import styles from './membersRoute.module.scss'

/** Shared look of the boolean "is this security feature on?" columns (2FA, SSO). */
function renderStatusBadge(isEnabled: boolean | null | undefined) {
  return isEnabled ? (
    <Badge size='s' color='light-blue' icon='check' />
  ) : (
    <Badge size='s' color='light-storm' icon='minus' />
  )
}

/**
 * API ordering names, not table column keys — the `Name` column orders by username (the endpoint cannot order by
 * full name) and the `Status` column by `status`.
 *
 * These must stay a subset of `OrganizationsMembersListOrdering`; building `ordering` below from them means an
 * invalid name here fails to typecheck. The 2FA column is absent because the endpoint cannot order by it.
 */
type MembersTableOrderableField = 'user__username' | 'status' | 'date_joined' | 'role'

const ORDERABLE_FIELDS: MembersTableOrderableField[] = ['user__username', 'status', 'date_joined', 'role']

function MembersRoute() {
  const [organization] = useOrganizationAssumed()
  const isUserAdminOrOwner =
    organization.request_user_role === MemberRoleEnum.owner || organization.request_user_role === MemberRoleEnum.admin

  const [opened, { open, close }] = useDisclosure(false)
  const mmoLabel = getSimpleMMOLabel(envStore.data, subscriptionStore.activeSubscriptions[0])

  const [pagination, setPagination] = useState({
    limit: DEFAULT_PAGE_SIZE,
    start: 0,
  })
  const [order, setOrder] = useState<SortableColumnOrder<MembersTableOrderableField>>({})

  const queryParams: OrganizationsMembersListParams = { ...pagination }
  if (order.fieldName && order.direction) {
    const orderPrefix = order.direction === 'descending' ? '-' : ''
    queryParams.ordering = `${orderPrefix}${order.fieldName}`
  }

  /**
   * Sorting affects which rows land on which page, so we go back to the first page whenever it changes. Updating from
   * the latest state, so we don't reset `limit` to a stale page size.
   */
  function updateOrder(newOrder: SortableColumnOrder<MembersTableOrderableField>) {
    setOrder(newOrder)
    setPagination((currentPagination) => {
      return { ...currentPagination, start: 0 }
    })
  }

  const membersQuery = useOrganizationsMembersList(organization.id, queryParams, {
    query: {
      queryKey: getOrganizationsMembersListQueryKey(organization.id, queryParams),
      placeholderData: keepPreviousData,
      // We might want to improve this in future, for now let's not retry
      retry: false,
      // The `refetchOnWindowFocus` option is `true` by default, I'm setting it
      // here so we don't forget about it.
      refetchOnWindowFocus: true,
    },
  })

  /**
   * Checks whether object should be treated as organization member or invitee.
   * Returns both an invite and member, but one of these will be null depending on status
   */
  function getMemberOrInviteDetails(obj: MemberListResponse) {
    const invite =
      obj.invite?.status === InviteStatusChoicesEnum.pending || obj.invite?.status === InviteStatusChoicesEnum.resent
        ? obj.invite
        : null
    const member = invite ? null : ({ ...obj } as MemberListResponse)
    return { invite, member }
  }

  /** Renders a column label that opens the sorting menu on click. */
  function renderSortableHeader(fieldName: MembersTableOrderableField, label: string) {
    return (
      <SortableProjectColumnHeader
        styling={false}
        field={{ name: fieldName, label }}
        orderableFields={ORDERABLE_FIELDS}
        order={order}
        onChangeOrderRequested={updateOrder}
        fixedWidth
      />
    )
  }

  const columns: Array<UniversalTableColumn<MemberListResponse>> = [
    {
      key: 'user__extra_details__name',
      label: renderSortableHeader('user__username', t('Name')),
      cellFormatter: (obj: MemberListResponse) => {
        const { invite, member } = getMemberOrInviteDetails(obj)
        return (
          <Avatar
            size='m'
            username={member ? member.user__username! : invite!.invitee!}
            isUsernameVisible
            email={member ? (member.user__email ?? undefined) : undefined}
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
      label: renderSortableHeader('status', t('Status')),
      size: 120,
      cellFormatter: (obj: MemberListResponse) => {
        const { invite } = getMemberOrInviteDetails(obj)
        if (invite) {
          return <Badge color='light-blue' size='s' label={t('Invited')} />
        } else {
          return <Badge color='light-green' size='s' label={t('Active')} />
        }
      },
    },
    {
      key: 'date_joined',
      label: renderSortableHeader('date_joined', t('Date added')),
      size: 140,
      cellFormatter: (obj: MemberListResponse) => {
        const { invite, member } = getMemberOrInviteDetails(obj)
        return invite ? formatDate(invite.created) : formatDate(member!.date_joined!)
      },
    },
    {
      key: 'role',
      label: renderSortableHeader('role', t('Role')),
      size: 140,
      cellFormatter: (obj: MemberListResponse) => {
        const { invite, member } = getMemberOrInviteDetails(obj)
        if (member?.role === MemberRoleEnum.owner || !isUserAdminOrOwner) {
          // If the member is the Owner or
          // If the user is not an owner or admin, we don't show the selector
          switch (member?.role || invite?.invitee_role) {
            case MemberRoleEnum.owner:
              return t('Owner')
            case MemberRoleEnum.admin:
              return t('Admin')
            case MemberRoleEnum.member:
              return t('Member')
            default:
              return t('Unknown')
          }
        }
        if (invite) {
          return (
            <MemberRoleSelector
              username={invite.invitee!}
              role={invite.invitee_role}
              currentUserRole={organization.request_user_role}
              inviteUrl={invite.url}
            />
          )
        }
        return (
          <MemberRoleSelector
            username={member!.user__username!}
            role={member!.role!}
            currentUserRole={organization.request_user_role}
          />
        )
      },
    },
    {
      key: 'user__has_mfa_enabled',
      label: t('2FA'),
      size: 90,
      cellFormatter: (obj: MemberListResponse) => {
        const { member } = getMemberOrInviteDetails(obj)
        return member ? renderStatusBadge(member.user__has_mfa_enabled) : undefined
      },
    },
  ]

  // The SSO column is always shown, but is inert until the organization has the SSO add-on.
  const isSsoColumnDisabled = !isSsoAvailable(envStore.data)
  columns.push({
    key: 'user__has_sso_enabled',
    label: (
      <Tooltip label={isSsoColumnDisabled ? t('Activate SSO add-on to enable') : t('SSO status')}>
        <span className={isSsoColumnDisabled ? styles.disabledColumnHeader : undefined}>{t('SSO')}</span>
      </Tooltip>
    ),
    size: 90,
    cellFormatter: (obj: MemberListResponse) => {
      if (isSsoColumnDisabled) {
        return undefined
      }
      const { member } = getMemberOrInviteDetails(obj)
      return member ? renderStatusBadge(member.user__has_sso_enabled) : undefined
    },
  })

  // Actions column is only for owner and admins.
  if (isUserAdminOrOwner) {
    columns.push({
      key: 'url',
      label: '',
      size: 64,
      isPinned: 'right',
      cellFormatter: (obj: MemberListResponse) => {
        const { invite, member } = getMemberOrInviteDetails(obj)
        // There is no action that can be done on an owner
        if (member?.role === MemberRoleEnum.owner) {
          return null
        }

        const target = <ActionIcon variant='transparent' size='md' iconName='more' />

        if (member) {
          return (
            <MemberActionsDropdown
              target={target}
              targetUsername={member?.user__username ?? invite!.invitee}
              currentUserRole={organization.request_user_role}
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

      {isUserAdminOrOwner && (
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

      <UniversalTable<MemberListResponse, ErrorDetail>
        columns={columns}
        queryResult={membersQuery}
        pagination={pagination}
        setPagination={setPagination}
      />
    </div>
  )
}

// `observer` so the SSO column appears as soon as `envStore` is ready.
export default observer(MembersRoute)
