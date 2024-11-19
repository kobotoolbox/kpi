// Libraries
import React from 'react';

// Partial components
import PaginatedQueryUniversalTable from 'js/universalTable/paginatedQueryUniversalTable.component';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import Avatar from 'js/components/common/avatar';

// Stores, hooks and utilities
import {formatTime} from 'js/utils';
import {useOrganizationQuery} from 'js/account/stripe.api';
import useOrganizationMembersQuery from './membersQuery';

// Constants and types
import type {OrganizationMember} from './membersQuery';

// Styles
import styles from './membersRoute.module.scss';

export default function MembersRoute() {
  const orgQuery = useOrganizationQuery();

  if (!orgQuery.data?.id) {
    return (
      <LoadingSpinner />
    );
  }

  return (
    <div className={styles.membersRouteRoot}>
      <header className={styles.header}>
        <h2 className={styles.headerText}>{t('Members')}</h2>
      </header>

      <PaginatedQueryUniversalTable<OrganizationMember>
        queryHook={useOrganizationMembersQuery}
        queryHookOptions={{organizationId: orgQuery.data.id}}
        columns={[
          {
            key: 'user__username',
            label: t('Name'),
            cellFormatter: (member: OrganizationMember) => {
              // TODO
              return (
                <>
                  <Avatar size='s' username={member.user__username} isUsernameVisible/>
                  &nbsp;
                  {member.user__name}
                  &nbsp;
                  @{member.user__username}
                  <br/>
                  {member.user__email}
                </>
              );
            },
          },
          {
            key: 'invite',
            label: t('Status'),
            size: 120,
            cellFormatter: (member: OrganizationMember) => {
              if (member.invite?.status) {
                return member.invite.status;
              }
              return null;
            },
          },
          {
            key: 'date_joined',
            label: t('Date added'),
            size: 130,
            cellFormatter: (member: OrganizationMember) => formatTime(member.date_joined),
          },
          {
            key: 'role',
            label: t('Role'),
            size: 120,
          },
          {
            key: 'user__has_mfa_enabled',
            label: t('2FA'),
            size: 90,
            cellFormatter: (member: OrganizationMember) => {
              if (member.user__has_mfa_enabled) {
                return 'yes';
              }
              return null;
            },
          },
          {
            // We use `url` here, but the cell would contain interactive UI
            // element
            key: 'url',
            label: '',
            size: 64,
            cellFormatter: () => {
              return 'TBD';
            },
          },
        ]}
      />
    </div>
  );
}
