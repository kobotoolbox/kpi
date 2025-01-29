// Libraries
import React from 'react';

// Partial components
import PaginatedQueryUniversalTable from 'js/universalTable/paginatedQueryUniversalTable.component';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import Avatar from 'js/components/common/avatar';
import Badge from 'jsapp/js/components/common/badge';
import MemberActionsDropdown from './MemberActionsDropdown';
import MemberRoleSelector from './MemberRoleSelector';

// Stores, hooks and utilities
import {formatTime} from 'js/utils';
import {OrganizationUserRole, useOrganizationQuery} from './organizationQuery';
import useOrganizationMembersQuery from './membersQuery';

// Constants and types
import type {OrganizationMember} from './membersQuery';
import type {UniversalTableColumn} from 'jsapp/js/universalTable/universalTable.component';

// Styles
import styles from './membersRoute.module.scss';

export default function MembersRoute() {
  const orgQuery = useOrganizationQuery();

  if (!orgQuery.data) {
    return (
      <LoadingSpinner />
    );
  }

  const columns: Array<UniversalTableColumn<OrganizationMember>> = [
    {
      key: 'user__extra_details__name',
      label: t('Name'),
      cellFormatter: (member: OrganizationMember) => (
        <Avatar
          size='m'
          username={member.user__username}
          isUsernameVisible
          email={member.user__email}
          // We pass `undefined` for the case it's an empty string
          fullName={member.user__extra_details__name || undefined}
        />
      ),
      size: 360,
    },
    {
      key: 'invite',
      label: t('Status'),
      size: 120,
      cellFormatter: (member: OrganizationMember) => {
        if (member.invite?.status) {
          return member.invite.status;
        } else {
          return <Badge color='light-green' size='s' label={t('Active')} />;
        }
        return null;
      },
    },
    {
      key: 'date_joined',
      label: t('Date added'),
      size: 140,
      cellFormatter: (member: OrganizationMember) => formatTime(member.date_joined),
    },
    {
      key: 'role',
      label: t('Role'),
      size: 140,
      cellFormatter: (member: OrganizationMember) => {
        if (
          member.role === OrganizationUserRole.owner ||
          !['owner', 'admin'].includes(orgQuery.data.request_user_role)
        ) {
          // If the member is the Owner or
          // If the user is not an owner or admin, we don't show the selector
          switch (member.role) {
            case OrganizationUserRole.owner:
              return t('Owner');
            case OrganizationUserRole.admin:
              return t('Admin');
            case OrganizationUserRole.member:
              return t('Member');
            default:
              return t('Unknown');
          }
        }
        return (
          <MemberRoleSelector
            username={member.user__username}
            role={member.role}
            currentUserRole={orgQuery.data.request_user_role}
          />
        );
      },
    },
    {
      key: 'user__has_mfa_enabled',
      label: t('2FA'),
      size: 90,
      cellFormatter: (member: OrganizationMember) => {
        if (member.user__has_mfa_enabled) {
          return <Badge size='s' color='light-blue' icon='check' />;
        }
        return <Badge size='s' color='light-storm' icon='minus' />;
      },
    },
  ];

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
      cellFormatter: (member: OrganizationMember) => {
        // There is no action that can be done on an owner
        if (member.role === OrganizationUserRole.owner) {
          return null;
        }

        return (
          <MemberActionsDropdown
            targetUsername={member.user__username}
            currentUserRole={orgQuery.data.request_user_role}
          />
        );
      },
    });
  }

  return (
    <div className={styles.membersRouteRoot}>
      <header className={styles.header}>
        <h2 className={styles.headerText}>{t('Members')}</h2>
      </header>

      <PaginatedQueryUniversalTable<OrganizationMember>
        queryHook={useOrganizationMembersQuery}
        columns={columns}
      />
    </div>
  );
}
