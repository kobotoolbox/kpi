import React, {useEffect, useState, useMemo} from 'react';
import useAccessLogsQuery, {
  AccessLog,
} from 'jsapp/js/query/queries/accessLogs.query';
import PaginatedQueryTable from './paginatedQueryTable.component';
import KoboSelect, {
  KoboSelectOption,
} from 'jsapp/js/components/common/koboSelect';
import Button from 'jsapp/js/components/common/button';

export default function AccessLogsSection() {
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
          type='full'
          color='dark-blue'
          isDisabled={currentPage >= availablePages}
          size='m'
          label='skip to last page'
          onClick={skipToLastPage}
        />
        <Button
          type='full'
          color='dark-blue'
          isDisabled={currentPage <= 1}
          size='m'
          label='skip to first page'
          onClick={skipToFirstPage}
        />
        <Button
          type='full'
          color='dark-blue'
          isDisabled={currentPage >= availablePages}
          size='m'
          label='next'
          onClick={onPageForward}
        />
        <Button
          type='full'
          color='dark-blue'
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
        <div>{data?.map((result) => <div>{result.source_browser}</div>)}</div>
      </div>
    );
  }

  return (
    <>
      <div>Access Logs</div>
      <PaginatedQueryTable
        queryHook={useAccessLogsQuery}
        renderDisplayTable={renderDataTable}
      />
    </>
  );
}
