import React from 'react';
import useAccessLogQuery, {type AccessLog} from 'js/query/queries/accessLog.query';
import PaginatedQueryUniversalTable from 'js/universalTable/paginatedQueryUniversalTable.component';
import {formatTime} from 'js/utils';

export default function AccessLogSection() {
  return (
    <>
      <h1>{t('Recent account activity')}</h1>

      <PaginatedQueryUniversalTable<AccessLog>
        queryHook={useAccessLogQuery}
        columns={[
          // The `key`s of these columns are matching the `AccessLog` interface
          // properties (from `accessLog.query.ts` file) using dot notation.
          {key: 'metadata.source', label: t('Source')},
          {
            key: 'date_created',
            label: t('Last activity'),
            cellFormatter: (date: string) => formatTime(date),
          },
          {key: 'metadata.ip_address', label: t('IP Address')},
        ]}
      />
    </>
  );
}
