import React, {useEffect, useState, useMemo} from 'react';
import useAccessLogQuery, {
  AccessLog,
} from 'jsapp/js/query/queries/accessLog.query';
import PaginatedQueryTable from './paginatedQueryTable.component';
import KoboSelect, {
  KoboSelectOption,
} from 'jsapp/js/components/common/koboSelect';
import Button from 'jsapp/js/components/common/button';
import UniversalTable from 'js/universalTable/universalTable.component';

export default function AccessLogSection() {
  function renderDataTable(
    data: AccessLog[] | undefined,
    availablePages: number,
    currentPage: number,
    currentLimit: string,
    perPageOptions: KoboSelectOption[],
    onPageForward: (event: any) => void,
    onPageBack: (event: any) => void,
    skipToLastPage: (event: any) => void,
    skipToFirstPage: (event: any) => void,
    onItemLimitChange: (event: any) => void
  ) {
    return (
      <div>
        <div>Available pages</div>
        <div>{availablePages}</div>
        <div>Current page</div>
        <div>{currentPage}</div>
        <Button
          type='secondary'
          isDisabled={currentPage >= availablePages}
          size='m'
          label='skip to last page'
          onClick={skipToLastPage}
        />
        <Button
          type='secondary'
          isDisabled={currentPage <= 1}
          size='m'
          label='skip to first page'
          onClick={skipToFirstPage}
        />
        <Button
          type='secondary'
          isDisabled={currentPage >= availablePages}
          size='m'
          label='next'
          onClick={onPageForward}
        />
        <Button
          type='secondary'
          size='m'
          label='back'
          isDisabled={currentPage <= 1}
          onClick={onPageBack}
        />
        <KoboSelect
          name={t('Items per page')}
          options={perPageOptions}
          size={'s'}
          type={'outline'}
          onChange={onItemLimitChange}
          selectedOption={currentLimit}
        />
        <div>{data?.map((result, index) => <div key={index}>{result.source_browser}</div>)}</div>
      </div>
    );
  }

  return (
    <>
      <div>Access Log</div>
      <PaginatedQueryTable
        queryHook={useAccessLogQuery}
        renderDisplayTable={renderDataTable}
      />

      <UniversalTable
        columns={[
          {key: 'source', label: t('Source')},
          {key: 'activity', label: t('Last activity')},
          {key: 'duration', label: t('Session duration'), isPinned: true},
          {key: 'ip', label: t('IP Address')},
          {key: 'a', label: 'a'},
          {key: 'b', label: 'b'},
          {key: 'c', label: 'c', size: 400},
          {key: 'd', label: 'd'},
          {key: 'e', label: 'e'},
          {key: 'f', label: 'f'},
          {key: 'g', label: 'g'},
        ]}
        data={[
          {source: 'Safari', activity: '15 minutes ago', duration: 'Your current session', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
          {source: 'Firefox', activity: '1 hour ago', duration: '0:10:30', ip: '123.456.789.255', a: '-', b: '-', c: '-', d: '-', e: '-', f: '-', g: '-'},
        ]}
        pagination={{
          currentPage: 2,
          totalPages: 10,
          pageSize: 10,
          pageSizes: [10, 30, 50, 100],
          requestPaginationChange: (newPageInfo) => {
            console.log('pagination change requested', newPageInfo);
          }
        }}
      />
    </>
  );
}
