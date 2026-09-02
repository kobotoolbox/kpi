import { Box, Divider, Group, Stack, Text, Title, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import { keepPreviousData } from '@tanstack/react-query'
import { observer } from 'mobx-react-lite'
import React, { useState } from 'react'
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
import DebouncedTextInput from '#/components/common/DebouncedTextInput'
import KoboIcon from '#/components/common/KoboIcon'
import Alert from '#/components/common/alert'
import Avatar from '#/components/common/avatar'
import Badge from '#/components/common/badge'
import envStore from '#/envStore'
import SortableProjectColumnHeader, {
  type SortableColumnOrder,
} from '#/projects/projectsTable/sortableProjectColumnHeader'
import { formatDate, notify } from '#/utils'
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

/**
 * We hold short phrase back instead of firing a request we already know fails on Backend.
 */
export const MIN_SEARCH_PHRASE_LENGTH = 3

/** Interpolated here rather than at the call site, so importers (stories) get the string the user actually sees. */
export const TOO_SHORT_WARNING = t('Type at least ##CHARACTER_COUNT## characters to search').replace(
  '##CHARACTER_COUNT##',
  String(MIN_SEARCH_PHRASE_LENGTH),
)

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
  const [searchPhrase, setSearchPhrase] = useState('')

  const trimmedSearchPhrase = searchPhrase.trim()
  const isSearchPhraseTooShort = trimmedSearchPhrase.length > 0 && trimmedSearchPhrase.length < MIN_SEARCH_PHRASE_LENGTH
  // An unusable phrase is treated as no search at all, so the user keeps seeing the full list while they type.
  const appliedSearchPhrase = isSearchPhraseTooShort ? '' : trimmedSearchPhrase

  const queryParams: OrganizationsMembersListParams = { ...pagination }
  if (order.fieldName && order.direction) {
    const orderPrefix = order.direction === 'descending' ? '-' : ''
    queryParams.ordering = `${orderPrefix}${order.fieldName}`
  }
  if (appliedSearchPhrase) {
    queryParams.q = appliedSearchPhrase
  }

  /**
   * Sorting and searching both change which rows land on which page, so either one sends us back to the first page.
   */
  function resetToFirstPage() {
    setPagination((currentPagination) => {
      return { ...currentPagination, start: 0 }
    })
  }

  function updateOrder(newOrder: SortableColumnOrder<MembersTableOrderableField>) {
    setOrder(newOrder)
    resetToFirstPage()
  }

  function updateSearchPhrase(newSearchPhrase: string) {
    setSearchPhrase(newSearchPhrase)
    resetToFirstPage()
  }

  /**
   * A phrase below the minimum length never reaches the endpoint, which is invisible unless we say something. Nagging
   * on every keystroke would punish anyone still typing, so we only speak up on Enter - the moment the user means
   * "search this now".
   *
   * The phrase comes off the event rather than `searchPhrase`: `DebouncedTextInput` owns the live text and flushes it
   * through `onChange`, so our state can still be a keystroke behind when this runs.
   */
  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }

    const enteredPhrase = event.currentTarget.value.trim()
    if (enteredPhrase.length > 0 && enteredPhrase.length < MIN_SEARCH_PHRASE_LENGTH) {
      notify.warning(TOO_SHORT_WARNING)
    }
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

  /**
   * Shown in place of the rows when there are none. Only the searching case is realistically reachable - an
   * organization always has at least its owner.
   */
  const emptyMessage = appliedSearchPhrase
    ? t('No members match "##SEARCH_PHRASE##"').replace('##SEARCH_PHRASE##', appliedSearchPhrase)
    : t('There are no members to display.')

  return (
    <div className={styles.membersRouteRoot}>
      <Group component='header' className={styles.header} justify='space-between' gap='md'>
        <h2 className={styles.headerText}>{t('Members')}</h2>

        <DebouncedTextInput
          value={searchPhrase}
          onChange={updateSearchPhrase}
          onKeyDown={onSearchKeyDown}
          placeholder={t('Search members')}
          leftSection={<KoboIcon icon={IconSearch} size='sm' />}
          // The input has no visible label, and the placeholder alone isn't announced reliably.
          aria-label={t('Search members')}
          w={260}
        />
      </Group>

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

      {membersQuery.isError ? (
        /*
         * `UniversalTable` renders nothing without a successful response, so the table would otherwise just disappear.
         * A rejected search phrase is the likeliest cause here (the backend parses `q` as a boolean query, so
         * characters like `:` or an unpaired quote are errors), and the specifics already arrive in a toast.
         */
        <Alert type='error'>
          {appliedSearchPhrase
            ? t('Could not search the members list. Try a different phrase.')
            : t('Could not load the members list.')}
        </Alert>
      ) : (
        <UniversalTable<MemberListResponse, ErrorDetail>
          columns={columns}
          queryResult={membersQuery}
          pagination={pagination}
          setPagination={setPagination}
          emptyMessage={emptyMessage}
        />
      )}
    </div>
  )
}

// `observer` so the SSO column appears as soon as `envStore` is ready.
export default observer(MembersRoute)
