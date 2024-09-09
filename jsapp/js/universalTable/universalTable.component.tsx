// Libraries
import React from 'react';
import cx from 'classnames';
import {
  type Column,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  PaginationState,
  TableOptions,
  useReactTable,
} from '@tanstack/react-table'

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
  label: React.ReactNode;
  isPinned?: boolean;
  /**
   * This is override for the default width of a column. Use it if you need more
   * space for your data, or if you display something very short.
   */
  size?: number;
}

interface UniversalTableDataItem {
  [key: string]: React.ReactNode;
}

interface UniversalTableProps {
  /** A list of column definitions */
  columns: UniversalTableColumn[];
  data: UniversalTableDataItem[];
  /** Pass the object to see footer with pagination. */
  pagination?: {
    currentPage: number;
    totalPages: number;
    /** One of `pageSizes` */
    pageSize: number;
    pageSizes: number[];
    /**
     * A way for the table to say "user wants to change pagination". It's being
     * triggered for both page size and page changes.
     */
    requestPaginationChange: (newPageInfo: PaginationState) => void;
  }
}

const columnHelper = createColumnHelper<UniversalTableDataItem>();

function getCommonClassNames(column: Column<UniversalTableDataItem>) {
  return cx({
    [styles.isPinned]: Boolean(column.getIsPinned()),
  })
}

const DEFAULT_COLUMN_SIZE = {
  size: 200, // starting column size
  minSize: 100, // enforced during column resizing
  maxSize: 600, // enforced during column resizing
};

export default function UniversalTable(props: UniversalTableProps) {
  const columns = props.columns.map((columnDef) => {
    return columnHelper.accessor(columnDef.key, {
      header: () => columnDef.label,
      cell: info => info.renderValue(),
      size: columnDef.size || DEFAULT_COLUMN_SIZE.size,
    })
  });

  // We define options as separate object to make the optional pagination truly
  // optional
  const options: TableOptions<UniversalTableDataItem> = {
    columns: columns,
    data: props.data,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    //override default column sizing
    defaultColumn: DEFAULT_COLUMN_SIZE,
  };

  options.state = {};

  // Set separately to not get overriden by pagination options
  options.state.columnPinning = {
    left: props.columns.filter(col => col.isPinned).map(col => col.key) || [],
  };

  // Add pagination related options if needed
  if (props.pagination) {
    options.manualPagination = true;
    options.pageCount = props.pagination.totalPages;
    options.state.pagination = {
      pageIndex: props.pagination.currentPage,
      pageSize: props.pagination.pageSize,
    };
    //update the pagination state when internal APIs mutate the pagination state
    options.onPaginationChange = (updater) => {
      // make sure updater is callable (to avoid typescript warning)
      if (typeof updater !== 'function') {return};

      const newPageInfo = updater(table.getState().pagination);

      props.pagination?.requestPaginationChange(newPageInfo);
    };
  }

  // Here we build the headless table that we would render below
  const table = useReactTable(options);

  return (
    <div className={styles.root}>
      <div className={styles.tableContainer}>
        <table
          className={cx(
            styles.table,
            {[styles.hasFooter]: Boolean(props.pagination)},
          )}
          style={{width: table.getTotalSize()}}
        >
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr
                key={headerGroup.id}
                className={styles.tableRow}
              >
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className={cx(
                      styles.tableHeaderCell,
                      getCommonClassNames(header.column),
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
                        className: cx(
                          styles.resizer,
                          {[styles.isResizing]: header.column.getIsResizing()}
                        ),
                      }}
                    />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className={styles.tableRow}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className={cx(
                      styles.tableCell,
                      getCommonClassNames(cell.column),
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

      {props.pagination &&
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
                __html: (
                  t('Page ##current_page## of ##total_pages##')
                    .replace('##current_page##', `<strong>${String(props.pagination.currentPage)}</strong>`)
                    .replace('##total_pages##', `<strong>${String(props.pagination.totalPages)}</strong>`)
                )
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
            options={props.pagination.pageSizes.map((pageSize) => (
              {
                value: String(pageSize),
                label: t('##number## rows').replace('##number##', String(pageSize)),
              }
            ))}
            selectedOption={String(table.getState().pagination.pageSize)}
            onChange={(newSelectedOption: string | null) => {
              table.setPageSize(Number(newSelectedOption));
            }}
            placement='up-left'
          />
        </footer>
      }
    </div>
  );
}
