import React, {useEffect, useState, useMemo} from 'react';
import useAccessLogQuery, {
  AccessLog,
} from 'jsapp/js/query/queries/accessLog.query';
import PaginatedQueryTable from './paginatedQueryTable.component';
import KoboSelect, {
  KoboSelectOption,
} from 'jsapp/js/components/common/koboSelect';
import Button from 'jsapp/js/components/common/button';

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
        <div>{data?.map((result) => <div>{result.source_browser}</div>)}</div>
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
    </>
  );
}