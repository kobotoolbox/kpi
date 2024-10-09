// Libraries
import {useState, useMemo} from 'react';

// Partial components
import UniversalTable from './universalTable.component';

// Types
import type {UseQueryResult} from '@tanstack/react-query';
import type {PaginatedResponse} from 'js/dataInterface';
import type {UniversalTableColumn} from './universalTable.component';

interface PaginatedQueryHook<DataItem> extends Function {
  (limit: number, offset: number): UseQueryResult<PaginatedResponse<DataItem>>;
}

interface PaginatedQueryUniversalTableProps<DataItem, RenderItem> {
  queryHook: PaginatedQueryHook<DataItem>;
  // Below are props from `UniversalTable` that should come from the parent
  // component (these are kind of "configuration" props). The other
  // `UniversalTable` props are being handled here internally.
  columns: UniversalTableColumn<DataItem>[];
}

const PAGE_SIZES = [10, 30, 50, 100];
const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

/**
 * This is a wrapper component for `UniversalTable`. It should be used in
 * situations when you use `react-query` to fetch data, and the data is
 * paginated. This component handles pagination in a neat, DRY way.
 *
 * All the rest of the functionalities are the same as `UniversalTable`.
 */
export default function PaginatedQueryUniversalTable<DataItem, RenderItem = DataItem>(
  {queryHook, columns, rowRenderer}: PaginatedQueryUniversalTableProps<DataItem, RenderItem>
) {
  const [pagination, setPagination] = useState({
    limit: DEFAULT_PAGE_SIZE,
    offset: 0,
  });

  const paginatedQuery = queryHook(pagination.limit, pagination.offset);

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
    <UniversalTable<DataItem | RenderItem>
      columns={columns}
      data={rowRenderer ? data.map((i) => rowRenderer(i)) : data}
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
