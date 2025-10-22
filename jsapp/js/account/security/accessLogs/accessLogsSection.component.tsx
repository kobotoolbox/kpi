import { keepPreviousData } from '@tanstack/react-query'
import React, { useState } from 'react'
import securityStyles from '#/account/security/securityRoute.module.scss'
import type { AccessLogResponse } from '#/api/models/accessLogResponse'
import type { ErrorDetail } from '#/api/models/errorDetail'
import {
  getAccessLogsMeListQueryKey,
  useAccessLogsMeExportCreate,
  useAccessLogsMeList,
} from '#/api/react-query/logging'
import Button from '#/components/common/button'
import ExportToEmailButton from '#/components/exportToEmailButton/exportToEmailButton.component'
import type { FailResponse } from '#/dataInterface'
import sessionStore from '#/stores/session'
import UniversalTable, { DEFAULT_PAGE_SIZE } from '#/UniversalTable'
import { formatTime } from '#/utils'

export default function AccessLogsSection() {
  const [pagination, setPagination] = useState({
    limit: DEFAULT_PAGE_SIZE,
    offset: 0,
  })
  const queryResult = useAccessLogsMeList(pagination, {
    query: {
      queryKey: getAccessLogsMeListQueryKey(pagination),
      placeholderData: keepPreviousData,
    },
  })
  const accessLogsMeExport = useAccessLogsMeExportCreate({
    request: {
      notifyAboutError: false,
    },
  })

  function logOutAllSessions() {
    sessionStore.logOutAll()
  }
  const handleStartExport = async () => {
    try {
      await accessLogsMeExport.mutateAsync()
    } catch (error) {
      const failResponse: FailResponse = {
        status: 500,
        statusText: (error as Error).message || t('An error occurred while exporting the logs'),
      }
      throw failResponse
    }
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

          <ExportToEmailButton label={t('Export log data')} exportFunction={handleStartExport} />
        </div>
      </header>

      <UniversalTable<AccessLogResponse, ErrorDetail>
        pagination={pagination}
        setPagination={setPagination}
        queryResult={queryResult}
        columns={[
          // The `key`s of these columns are matching the `AccessLog` interface
          // properties (from `accessLogs.query.ts` file) using dot notation.
          {
            key: 'metadata.source',
            label: t('Source'),
            cellFormatter: (log: AccessLogResponse) => {
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
            cellFormatter: (log: AccessLogResponse) => formatTime(log.date_created),
          },
          { key: 'metadata.ip_address', label: t('IP Address') },
        ]}
      />
    </>
  )
}
