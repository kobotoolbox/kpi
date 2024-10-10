// Libraries
import React from 'react';

// Partial components
// import Button from 'js/components/common/button';
import PaginatedQueryUniversalTable from 'js/universalTable/paginatedQueryUniversalTable.component';

// Utilities
import useAccessLogsQuery, {type AccessLog} from 'js/query/queries/accessLogs.query';
import {formatTime} from 'js/utils';
// import sessionStore from 'js/stores/session';

// Styles
import securityStyles from 'js/account/security/securityRoute.module.scss';

export default function AccessLogsSection() {
  // function logOutAllSessions() {
  //   sessionStore.logOutAll();
  // }

  return (
    <>
      <header className={securityStyles.securityHeader}>
        <h2 className={securityStyles.securityHeaderText}>
          {t('Recent account activity')}
        </h2>

        {/* TODO: we comment this out until we know how to handle exsiting
        sessions for the moment of release of the feature. */}
        {/*<div className={securityStyles.securityHeaderActions}>
          <Button
            type='text'
            size='m'
            onClick={logOutAllSessions}
            label={t('Log out of all devices')}
            startIcon='logout'
          />
        </div>*/}
      </header>

      <PaginatedQueryUniversalTable<AccessLog>
        queryHook={useAccessLogsQuery}
        columns={[
          // The `key`s of these columns are matching the `AccessLog` interface
          // properties (from `accessLogs.query.ts` file) using dot notation.
          {
            key: 'metadata.source',
            label: t('Source'),
            cellFormatter: (log: AccessLog) => {
              if (log.metadata.auth_type === 'submission-group') {
                return t('Data Submissions (##count##)').replace('##count##', String(log.count));
              } else {
                return log.metadata.source;
              }
            },
          },
          {
            key: 'date_created',
            label: t('Last activity'),
            cellFormatter: (log: AccessLog) => formatTime(log.date_created),
          },
          {key: 'metadata.ip_address', label: t('IP Address')},
        ]}
      />
    </>
  );
}
