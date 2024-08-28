import React, {useEffect, useState, useMemo, Component} from 'react';
import useAccessLogQuery from 'jsapp/js/query/queries/accessLog.query';
import KoboSelect from 'jsapp/js/components/common/koboSelect';
import {UseQueryResult} from '@tanstack/react-query';
import {PaginatedResponse} from 'jsapp/js/dataInterface';
import Button from 'jsapp/js/components/common/button';

interface PaginatedQueryHook extends Function {
  (limit: number, offset: number): UseQueryResult<PaginatedResponse<any>>;
}

interface PaginatedQueryTableProps {
  queryHook: PaginatedQueryHook,
  renderDisplayTable: Function
}

const PaginatedQueryTable = (props: PaginatedQueryTableProps) => {
  const [currentPageLimitOffset, setCurrentPageLimitOffset] = useState({
    limit: 10,
    offset: 0,
  });

  const paginatedQuery = props.queryHook(
    currentPageLimitOffset.limit,
    currentPageLimitOffset.offset
  );

  const availablePages = useMemo(() => {
    return Math.ceil(
      (paginatedQuery.data?.count ?? 0) / currentPageLimitOffset.limit
    );
  }, [paginatedQuery.data]);

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
  };

  const skipToFirstPage = () => {
    setCurrentPageLimitOffset({
      limit: currentPageLimitOffset.limit,
      offset: 0,
    });
  };

  return props.renderDisplayTable(
    paginatedQuery.data?.results,
    availablePages,
    currentPage,
    currentPageLimitOffset.limit.toString(),
    perPageOptions,
    onPageForward,
    onPageBack,
    skipToLastPage,
    skipToFirstPage,
    onItemLimitChange
  );
}

export default PaginatedQueryTable
