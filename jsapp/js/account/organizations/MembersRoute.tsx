// Libraries
import React from 'react';

// Partial components
import PaginatedQueryUniversalTable from 'js/universalTable/paginatedQueryUniversalTable.component';

// Stores, hooks and utilities
import {formatTime} from 'js/utils';
import useOrganiztionMembersQuery from './membersQuery';

// Constants and types
import type {OrganizationMember} from './membersQuery';

// Styles
import styles from './membersRoute.module.scss';

export default function MembersRoute() {
  return (
    <div className={styles.membersRouteRoot}>
      <header className={styles.header}>
        <h2 className={styles.headerText}>{t('Members')}</h2>
      </header>

      <PaginatedQueryUniversalTable<OrganizationMember>
        queryHook={useOrganiztionMembersQuery}
        columns={[
          {
            key: 'user__username',
            label: t('Name'),
            cellFormatter: (member: OrganizationMember) => {
              // TODO
              return (
                <>
                  {member.user__name}
                  @{member.user__username}
                  {member.user__email}
                </>
              );
            },
          },
          {
            key: 'invite.status',
            label: t('Status'),
          },
          {
            key: 'date_joined',
            label: t('Date added'),
            cellFormatter: (member: OrganizationMember) => formatTime(member.date_joined),
          },
          {
            key: 'role',
            label: t('Role'),
          },
          {
            key: 'user__has_mfa_enabled',
            label: t('2FA'),
            cellFormatter: (member: OrganizationMember) => {
              if (member.user__has_mfa_enabled) {
                return 'yes';
              } else {
                return null;
              }
            },
          },
          {
            // We use `url` here, but the cell would contain interactive UI
            // element
            key: 'url',
            label: '',
            cellFormatter: () => {
              return 'TBD';
            },
          },
        ]}
      />
    </div>
  );
}
