// Libraries
import React, {type ReactNode} from 'react';
import cx from 'classnames';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Column,
  type PaginationState,
  type TableOptions,
} from '@tanstack/react-table';

// Partial components
import Button from 'js/components/common/button';
import KoboSelect from 'js/components/common/koboSelect';

// Utilities
import {generateUuid} from 'js/utils';

// Styles
import styles from './universalTable.module.scss';

interface UniversalTableColumn {
  /** Pairs to data object properties */
  key: string;
  /**
   * Most of the times this would be just a string, but we are open to
   * anything really.
   */
  label: ReactNode;
  isPinned?: boolean;
  /**
   * This is override for the default width of a column. Use it if you need more
   * space for your data, or if you display something very short.
   */
  size?: number;
}

interface UniversalTableDataItem {
  [key: string]: ReactNode;
}

interface UniversalTableProps {
  /** A list of column definitions */
  columns: UniversalTableColumn[];
  data: UniversalTableDataItem[];
  /** Pass the object to see footer with pagination. */
  pagination?: {
    /**
     * Total number of items from all pages of data. Total pages number will be
     * calculated from this x pageSize. This makes it easier to use this table
     * with the API endpoints (see `PaginatedResponse` interface).
     */
    totalItems: number;
    /** One of `pageSizes` */
    pageSize: number;
    pageSizes: number[];
    /**
     * A way for the table to say "user wants to change pagination". It's being
     * triggered for both page size and page changes.
     */
    requestPaginationChange: (newPageInfo: PaginationState) => void;
  };
}

const columnHelper = createColumnHelper<UniversalTableDataItem>();

function getCommonClassNames(column: Column<UniversalTableDataItem>) {
  return cx({
    [styles.isPinned]: Boolean(column.getIsPinned()),
  });
}

const DEFAULT_COLUMN_SIZE = {
  size: 200, // starting column size
  minSize: 100, // enforced during column resizing
  maxSize: 600, // enforced during column resizing
};

export default function UniversalTable(props: UniversalTableProps) {
  const columns = props.columns.map((columnDef) =>
    columnHelper.accessor(columnDef.key, {
      header: () => columnDef.label,
      cell: (info) => info.renderValue(),
      size: columnDef.size || DEFAULT_COLUMN_SIZE.size,
    })
  );

  // We define options as separate object to make the optional pagination truly
  // optional.
  const options: TableOptions<UniversalTableDataItem> = {
    columns: columns,
    data: props.data,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    //override default column sizing
    defaultColumn: DEFAULT_COLUMN_SIZE,
  };

  options.state = {};

  // Set separately to not get overriden by pagination options. This is a list
  // of columns that are pinned to the left side.
  options.state.columnPinning = {
    left: props.columns.filter((col) => col.isPinned).map((col) => col.key) || [],
  };

  // Add pagination related options if needed
  if (props.pagination) {
    options.manualPagination = true;
    options.rowCount = props.pagination.totalItems;
    options.initialState = {
      pagination: {
        pageSize: props.pagination.pageSize,
      },
    };
    //update the pagination state when internal APIs mutate the pagination state
    options.onPaginationChange = (updater) => {
      // make sure updater is callable (to avoid typescript warning)
      if (typeof updater !== 'function') {
        return;
      }

      // The `table` below is defined before usage, but we are sure it will be
      // there, given this is a callback function for it.
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      const newPageInfo = updater(table.getState().pagination);

      props.pagination?.requestPaginationChange(newPageInfo);
    };
  }

  // Here we build the headless table that we would render below
  const table = useReactTable(options);

  const currentPageString = String(table.getState().pagination.pageIndex + 1);
  const totalPagesString = String(table.getPageCount());

  return (
    <div className={styles.universalTableRootContainer}>
      <div className={styles.universalTableRoot}>
        <div className={styles.tableContainer}>
          <table className={styles.table} style={{width: table.getTotalSize()}}>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className={styles.tableRow}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cx(
                        styles.tableHeaderCell,
                        getCommonClassNames(header.column)
                      )}
                      style={{width: `${header.getSize()}px`}}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}

                      {/*
                        TODO: if we ever see performance issues while resizing,
                        there is a way to fix that, see:
                        https://tanstack.com/table/latest/docs/guide/column-sizing#advanced-column-resizing-performance
                      */}
                      <div
                        {...{
                          onDoubleClick: () => header.column.resetSize(),
                          onMouseDown: header.getResizeHandler(),
                          onTouchStart: header.getResizeHandler(),
                          className: cx(styles.resizer, {
                            [styles.isResizing]: header.column.getIsResizing(),
                          }),
                        }}
                      />
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className={styles.tableRow}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cx(
                        styles.tableCell,
                        getCommonClassNames(cell.column)
                      )}
                      style={{width: `${cell.column.getSize()}px`}}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {props.pagination && (
          <footer className={styles.tableFooter}>
            <section className={styles.pagination}>
              <Button
                type='text'
                size='s'
                onClick={() => table.firstPage()}
                isDisabled={!table.getCanPreviousPage()}
                startIcon='angle-bar-left'
              />

              <Button
                type='text'
                size='s'
                onClick={() => table.previousPage()}
                isDisabled={!table.getCanPreviousPage()}
                startIcon='angle-left'
              />

              <div
                className={styles.paginationNumbering}
                dangerouslySetInnerHTML={{
                  __html: t('Page ##current_page## of ##total_pages##')
                    .replace('##current_page##', `<strong>${currentPageString}</strong>`)
                    .replace('##total_pages##', `<strong>${totalPagesString}</strong>`),
                }}
              />

              <Button
                type='text'
                size='s'
                onClick={() => table.nextPage()}
                isDisabled={!table.getCanNextPage()}
                startIcon='angle-right'
              />

              <Button
                type='text'
                size='s'
                onClick={() => table.lastPage()}
                isDisabled={!table.getCanNextPage()}
                startIcon='angle-bar-right'
              />
            </section>

            <KoboSelect
              className={styles.pageSizeSelect}
              name={`universal-table-select-${generateUuid()}`}
              type='outline'
              size='s'
              options={props.pagination.pageSizes.map((pageSize) => {
                return {
                  value: String(pageSize),
                  label: t('##number## rows').replace('##number##', String(pageSize)),
                };
              })}
              selectedOption={String(table.getState().pagination.pageSize)}
              onChange={(newSelectedOption: string | null) => {
                table.setPageSize(Number(newSelectedOption));
              }}
              placement='up-left'
            />
          </footer>
        )}
      </div>
    </div>
  );
}
