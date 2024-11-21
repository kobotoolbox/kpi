// Libraries
import React from 'react';

// Partial components
import PaginatedQueryUniversalTable from 'js/universalTable/paginatedQueryUniversalTable.component';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import Avatar from 'js/components/common/avatar';
import Badge from 'jsapp/js/components/common/badge';

// Stores, hooks and utilities
import {formatTime} from 'js/utils';
import {useOrganizationQuery} from './organizationQuery';
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
        columns={[
          {
            key: 'user__username',
            label: t('Name'),
            cellFormatter: (member: OrganizationMember) => (
              <Avatar
                size='m'
                username={member.user__username}
                isUsernameVisible
                email={member.user__email}
                // We pass `undefined` for the case it's an empty string
                fullName={member.user__name || undefined}
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
            size: 120,
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
          {
            // We use `url` here, but the cell would contain interactive UI
            // element
            key: 'url',
            label: '',
            size: 64,
            // TODO: this will be added soon
            cellFormatter: () => (' '),
          },
        ]}
      />
    </div>
  );
}
