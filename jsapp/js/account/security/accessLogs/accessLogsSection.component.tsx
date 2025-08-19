import React, { useState } from 'react'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import securityStyles from '#/account/security/securityRoute.module.scss'
import Button from '#/components/common/button'
import ExportToEmailButton from '#/components/exportToEmailButton/exportToEmailButton.component'
import { QueryKeys } from '#/query/queryKeys'
import sessionStore from '#/stores/session'
import PaginatedQueryUniversalTable, { DEFAULT_PAGE_SIZE } from '#/universalTable/PaginatedQueryUniversalTable'
import { formatTime } from '#/utils'
import { type AccessLog, getAccessLogs, startAccessLogsExport } from './accessLogs.query'

export default function AccessLogsSection() {
  const [pagination, setPagination] = useState({
    limit: DEFAULT_PAGE_SIZE,
    offset: 0,
  })
  const queryResult = useQuery({
    queryKey: [QueryKeys.accessLogs, pagination.limit, pagination.offset],
    queryFn: () => getAccessLogs(pagination.limit, pagination.offset),
    placeholderData: keepPreviousData,
    // We might want to improve this in future, for now let's not retry
    retry: false,
    // The `refetchOnWindowFocus` option is `true` by default, I'm setting it
    // here so we don't forget about it.
    refetchOnWindowFocus: true,
  })

  function logOutAllSessions() {
    sessionStore.logOutAll()
  }

  return (
    <>
      <header className={securityStyles.securityHeader}>
        <h2 className={securityStyles.securityHeaderText}>{t('Recent account activity')}</h2>
        <div className={securityStyles.securityHeaderActions}>
          <Button
            type='text'
            size='m'
            onClick={logOutAllSessions}
            label={t('Log out of all devices')}
            startIcon='logout'
          />

          <ExportToEmailButton label={t('Export log data')} exportFunction={startAccessLogsExport} />
        </div>
      </header>

      <PaginatedQueryUniversalTable<AccessLog>
        pagination={pagination}
        setPagination={setPagination}
        queryResult={queryResult}
        columns={[
          // The `key`s of these columns are matching the `AccessLog` interface
          // properties (from `accessLogs.query.ts` file) using dot notation.
          {
            key: 'metadata.source',
            label: t('Source'),
            cellFormatter: (log: AccessLog) => {
              if (log.metadata.auth_type === 'submission-group') {
                return t('Data Submissions (##count##)').replace('##count##', String(log.count))
              } else {
                return log.metadata.source
              }
            },
          },
          {
            key: 'date_created',
            label: t('Last activity'),
            cellFormatter: (log: AccessLog) => formatTime(log.date_created),
          },
          { key: 'metadata.ip_address', label: t('IP Address') },
        ]}
      />
    </>
  )
}
