import React, { useState } from 'react'

import { keepPreviousData } from '@tanstack/react-query'
import UniversalTable, { DEFAULT_PAGE_SIZE } from '#/UniversalTable'
import securityStyles from '#/account/security/securityRoute.module.scss'
import { ServerError } from '#/api/ServerError'
import type { AccessLogResponse } from '#/api/models/accessLogResponse'
import type { ErrorDetail } from '#/api/models/errorDetail'
import { type OrvalFetchError, getApiErrorMessage } from '#/api/onErrorDefaultHandler'
import {
  getAccessLogsMeListQueryKey,
  useAccessLogsMeExportCreate,
  useAccessLogsMeList,
} from '#/api/react-query/logging'
import Button from '#/components/common/button'
import ExportToEmailButton from '#/components/exportToEmailButton/exportToEmailButton.component'
import type { FailResponse } from '#/dataInterface'
import sessionStore from '#/stores/session'
import { formatTime } from '#/utils'

export enum AccessLogAction {
  AUTH = 'auth',
  AUTH_FAILED = 'auth-failed',
}

export default function AccessLogsSection() {
  const [pagination, setPagination] = useState({
    limit: DEFAULT_PAGE_SIZE,
    start: 0,
  })
  const queryResult = useAccessLogsMeList(pagination, {
    query: {
      queryKey: getAccessLogsMeListQueryKey(pagination),
      placeholderData: keepPreviousData,
    },
  })
  const accessLogsMeExport = useAccessLogsMeExportCreate({
    mutation: {
      onError: () => null, // supress default toast on error because <ExportToEmailButton/> handles error inline.
    },
  })

  function logOutAllSessions() {
    sessionStore.logOutAll()
  }
  const handleStartExport = async () => {
    try {
      await accessLogsMeExport.mutateAsync()
    } catch (error) {
      // `handleApiFail()` displays `responseText`, and falls back to a generic
      // message of its own when backend didn't send one.
      const failResponse: FailResponse = {
        status: error instanceof ServerError ? error.response.status : 0,
        statusText: (error as Error).message,
        responseText: getApiErrorMessage(error as OrvalFetchError) ?? undefined,
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
            key: 'action',
            label: t('Action'),
            cellFormatter: (log: AccessLogResponse) => {
              return log.action === AccessLogAction.AUTH_FAILED ? t('Failed') : t('Success')
            },
          },
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
