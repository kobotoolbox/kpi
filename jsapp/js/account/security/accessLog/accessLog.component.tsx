import React, {useEffect, useState, useMemo} from 'react';
import useAccessLogQuery from 'jsapp/js/query/queries/accessLog.query';
import KoboSelect from 'jsapp/js/components/common/koboSelect';
import Button from 'jsapp/js/components/common/button';

export default function AccessLogSection() {
  const [currentPageLimitOffset, setCurrentPageLimitOffset] = useState({
    limit: 10,
    offset: 0,
  });

  const accessLogQuery = useAccessLogQuery(
    currentPageLimitOffset.limit,
    currentPageLimitOffset.offset
  );

  const availablePages = useMemo(() => {
    return Math.ceil(
      (accessLogQuery.data?.count ?? 0) / currentPageLimitOffset.limit
    );
  }, [accessLogQuery.data]);

  const currentPage = useMemo(() => {
    return (
      Math.ceil(currentPageLimitOffset.offset / currentPageLimitOffset.limit) +
      1
    );
  }, [currentPageLimitOffset.offset, currentPageLimitOffset.limit]);

  const perPageOptions = [
    {label: '10', value: '10'},
    {label: '20', value: '20'},
    {label: '30', value: '30'},
  ];

  const onItemLimitChange = (value: string | null) => {
    if (value === null) {
      return;
    }
    const limit = parseInt(value);
    if (limit) {
      setCurrentPageLimitOffset({limit, offset: 0});
    }
  };

  const onPageForward = () => {
    setCurrentPageLimitOffset({
      limit: currentPageLimitOffset.limit,
      offset: currentPageLimitOffset.offset + currentPageLimitOffset.limit,
    });
  };

  const onPageBack = () => {
    setCurrentPageLimitOffset({
      limit: currentPageLimitOffset.limit,
      offset: currentPageLimitOffset.offset - currentPageLimitOffset.limit,
    });
  };

  const skipToLastPage = () => {
    setCurrentPageLimitOffset({
      limit: currentPageLimitOffset.limit,
      offset: (availablePages - 1) * currentPageLimitOffset.limit,
    });
  }

  const skipToFirstPage = () => {
    setCurrentPageLimitOffset({
      limit: currentPageLimitOffset.limit,
      offset: 0,
    });
  };

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
        selectedOption={currentPageLimitOffset.limit.toString()}
      />
      <div>{accessLogQuery.data?.results.map((result) => (<div>{result.source_browser}</div>))}</div>
    </div>
  );
}
