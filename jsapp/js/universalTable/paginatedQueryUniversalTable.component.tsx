// Libraries
import React, {useState, useMemo} from 'react';

// Partial components
import UniversalTable from './universalTable.component';

// Types
import type {UseQueryResult} from '@tanstack/react-query';
import type {PaginatedResponse} from 'js/dataInterface';
import type {UniversalTableColumn} from './universalTable.component';
import type {Record} from 'immutable';

type PaginatedQueryHookData = Record<string, string | number | boolean>;

export type PaginatedQueryHookParams = {
  limit: number;
  offset: number;
} & PaginatedQueryHookData;

interface PaginatedQueryHook<DataItem> {
  (
    params: PaginatedQueryHookParams
  ): UseQueryResult<PaginatedResponse<DataItem>>;
}

interface PaginatedQueryUniversalTableProps<DataItem> {
  queryHook: PaginatedQueryHook<DataItem>;
  queryHookData?: PaginatedQueryHookData;
  // Below are props from `UniversalTable` that should come from the parent
  // component (these are kind of "configuration" props). The other
  // `UniversalTable` props are being handled here internally.
  columns: Array<UniversalTableColumn<DataItem>>;
}

const PAGE_SIZES = [10, 30, 50, 100];
const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

/**
 * This is a wrapper component for `UniversalTable`. It should be used in
 * situations when you use `react-query` to fetch data, and the data is
 * paginated. This component handles pagination in a neat, DRY way.
 *
 * This component receives a `queryHook` prop, which is a function that should
 * return a `react-query` query object. This function should be a paginated ready
 * query function, meaning that it should accept an object with the following
 * properties:
 * - `limit`: number of items per page
 * - `offset`: offset of the page
 * - `...`: any other data that you need to pass to the query (passed via the `queryHookData` prop)
 *
 * While the `limit` and `offset` properties are used internally to handle the
 * pagination, the rest of the properties are passed to the `queryHook` function
 * when fetching data via the `queryHookData` prop.
 *
 * The queryHookData prop is an object containing any other data that you need
 * to pass to the query, like ids or filters. This data will be passed to the
 * `queryHook` function along with `limit` and `offset`.
 *
 * All the rest of the functionalities are the same as `UniversalTable`.
 */
export default function PaginatedQueryUniversalTable<DataItem>(
  props: PaginatedQueryUniversalTableProps<DataItem>
) {
  const [pagination, setPagination] = useState({
    limit: DEFAULT_PAGE_SIZE,
    offset: 0,
  });

  const paginatedQuery = props.queryHook({
    ...props.queryHookData,
    limit: pagination.limit,
    offset: pagination.offset,
  });

  const availablePages = useMemo(
    () => Math.ceil((paginatedQuery.data?.count ?? 0) / pagination.limit),
    [paginatedQuery.data, pagination]
  );

  const currentPageIndex = useMemo(
    () => Math.ceil(pagination.offset / pagination.limit),
    [pagination]
  );

  const data = paginatedQuery.data?.results || [];

  return (
    <UniversalTable<DataItem>
      columns={props.columns}
      data={data}
      isSpinnerVisible={paginatedQuery.isFetching}
      pageIndex={currentPageIndex}
      pageCount={availablePages}
      pageSize={pagination.limit}
      pageSizeOptions={PAGE_SIZES}
      onRequestPaginationChange={(newPageInfo, oldPageInfo) => {
        // Calculate new offset and limit from what we've got
        let newOffset = newPageInfo.pageIndex * newPageInfo.pageSize;
        const newLimit = newPageInfo.pageSize;

        // If we change page size, we switch back to first page
        if (newPageInfo.pageSize !== oldPageInfo.pageSize) {
          newOffset = 0;
        }

        setPagination({limit: newLimit, offset: newOffset});
      }}
    />
  );
}
