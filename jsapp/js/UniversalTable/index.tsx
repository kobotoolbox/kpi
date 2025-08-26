import React, { useMemo } from 'react'

import type { UseQueryResult } from '@tanstack/react-query'
import UniversalTableCore from './UniversalTableCore'
import type { UniversalTableColumn } from './UniversalTableCore'

export type { UniversalTableColumn } from './UniversalTableCore'

export interface Pagination {
  limit: number
  offset: number
}

export interface PaginatedListResponseData<Datum = never> {
  count: number
  /** @nullable */
  next?: string | null
  /** @nullable */
  previous?: string | null
  results: Datum[]
}

export type PaginatedListResponse<Datum = never> = PaginatedListResponse.Ok<Datum> | PaginatedListResponse.NotFound
export namespace PaginatedListResponse {
  export interface Ok<Datum = never> {
    data: PaginatedListResponseData<Datum>
    status: 200
  }
  export interface NotFound {
    data: unknown
    status: 404
  }
}

interface UniversalTableProps<Datum> {
  // Below are props from `UniversalTable` that should come from the parent
  // component (these are kind of "configuration" props). The other
  // `UniversalTable` props are being handled here internally.
  columns: Array<UniversalTableColumn<Datum>>
  queryResult: UseQueryResult<PaginatedListResponse<Datum>>
  pagination: Pagination
  setPagination: (pagination: Pagination) => unknown
}

export const PAGE_SIZES = [10, 30, 50, 100]
export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0]

/**
 * Displays paginated data directly from a `react-query` hook.
 * For displaying custom data structures use UniversalTableCore directly.
 *
 * Boilerplate:
 *
 * ```tsx
 * import UniversalTable, { DEFAULT_PAGE_SIZE } from '#/UniversalTable'
 *
 * const Example = () => {
 *   const [pagination, setPagination] = useState({
 *     limit: DEFAULT_PAGE_SIZE,
 *     offset: 0,
 *   })
 *   const queryResult = useQuery({
 *     ...
 *   })
 *   return <UniversalTable<Datum>
 *     pagination={pagination}
 *     setPagination={setPagination}
 *     queryResult={queryResult}
 *     columns={[
 *       { key: 'name', label: t('Name'), cellFormatter: (datum: Datum) => datum.name.toLowerCase() },
 *       ...
 *     ]}
 *   />
 * }
 * ```
 */
export default function UniversalTable<Datum>({
  columns,
  pagination,
  queryResult,
  setPagination,
}: UniversalTableProps<Datum>) {
  const availablePages = useMemo(
    () => (queryResult.data?.status === 200 ? Math.ceil(queryResult.data?.data?.count / pagination.limit) : 0),
    [pagination.limit, queryResult.data?.status, (queryResult.data?.data as PaginatedListResponseData<Datum>)?.count],
  )

  const currentPageIndex = useMemo(() => Math.ceil(pagination.offset / pagination.limit), [pagination])

  if (queryResult.data?.status !== 200) return null

  return (
    <UniversalTableCore<Datum>
      columns={columns}
      data={queryResult.data?.data.results ?? []}
      isSpinnerVisible={queryResult.isFetching}
      pageIndex={currentPageIndex}
      pageCount={availablePages}
      pageSize={pagination.limit}
      pageSizeOptions={PAGE_SIZES}
      onRequestPaginationChange={(newPageInfo, oldPageInfo) => {
        // Calculate new offset and limit from what we've got
        let newOffset = newPageInfo.pageIndex * newPageInfo.pageSize
        const newLimit = newPageInfo.pageSize

        // If we change page size, we switch back to first page
        if (newPageInfo.pageSize !== oldPageInfo.pageSize) {
          newOffset = 0
        }

        setPagination({ limit: newLimit, offset: newOffset })
      }}
    />
  )
}
