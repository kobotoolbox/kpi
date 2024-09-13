// Libraries
import React from 'react';
import cx from 'classnames';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type CellContext,
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

export interface UniversalTableColumn {
  /**
   * Pairs to data object properties. It is using dot notation, so it's possible
   * to match data from a nested object :ok:.
   */
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
  /**
   * This is an optional formatter function that will be used when rendering
   * the cell value. Without it a literal text value will be rendered.
   */
  cellFormatter?: (value: string) => React.ReactNode;
}

interface UniversalTableProps<DataItem> {
  /** A list of column definitions */
  columns: UniversalTableColumn[];
  data: DataItem[];
  // PAGINATION
  // To see footer with pagination you need to pass all these below:
  /** Starts with `0` */
  pageIndex?: number;
  /** Total number of pages of data. */
  pageCount?: number;
  /**
   * One of `pageSizes`. It is de facto the `limit` from the `offset` + `limit`
   * pair used for paginatin the endpoint.
   */
  pageSize?: number;
  pageSizes?: number[];
  /**
   * A way for the table to say "user wants to change pagination". It's being
   * triggered for both page size and page changes.
   */
  onRequestPaginationChange?: (
    /**
     * Provides an object with current `pageIndex` and `pageSize` (one or both
     * values are new). The second object shows previous pagination, use it to
     * compare what has happened :)
     */
    newPageInfo: PaginationState,
    oldPageInfo: PaginationState
  ) => void;
  // ENDPAGINATION
}

const DEFAULT_COLUMN_SIZE = {
  size: 200, // starting column size
  minSize: 100, // enforced during column resizing
  maxSize: 600, // enforced during column resizing
};

/**
 * This is a nice wrapper for the `@tanstack/react-table`. It uses only
 * a limited selection of all possible features, and provides consistent looks.
 *
 * You are responsible for passing column definitions (important!) and the data
 * to match these definitions (obviously). When using it, you need to also pass
 * the TS type of the data item, so it knows what to expect.
 *
 * It has column pinning (on column definition level, i.e. you need to tell it
 * which columns are pinned), and column resizing (works out of the box!).
 *
 * It has (optional) pagination. If you pass all the required props, you can
 * expect to get user pagination requests through the callback function named
 * `onRequestPaginationChange`.
 */
export default function UniversalTable<DataItem>(
  props: UniversalTableProps<DataItem>
) {
  function getCommonClassNames(column: Column<DataItem>) {
    return cx({
      [styles.isPinned]: Boolean(column.getIsPinned()),
    });
  }

  const columns = props.columns.map((columnDef) => {
    return {
      accessorKey: columnDef.key,
      header: () => columnDef.label,
      cell: (cellProps: CellContext<DataItem, string>) => {
        if (columnDef.cellFormatter) {
          return columnDef.cellFormatter(cellProps.getValue());
        } else {
          return cellProps.renderValue();
        }
      },
      size: columnDef.size || DEFAULT_COLUMN_SIZE.size,
    };
  });

  // We define options as separate object to make the optional pagination truly
  // optional.
  const options: TableOptions<DataItem> = {
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
  const pinnedColumns = props.columns
    .filter((col) => col.isPinned)
    .map((col) => col.key);
  options.state.columnPinning = {left: pinnedColumns || []};

  const hasPagination = (
    props.pageIndex !== undefined &&
    props.pageCount !== undefined &&
    props.pageSize !== undefined &&
    props.pageSizes !== undefined &&
    props.onRequestPaginationChange !== undefined
  );

  // Add pagination related options if needed
  if (
    hasPagination &&
    // `hasPagination` handles everything, but we need these two for TypeScript:
    props.pageSize !== undefined &&
    props.pageIndex !== undefined
  ) {
    options.manualPagination = true;
    options.pageCount = props.pageCount;
    options.state.pagination = {
      pageSize: props.pageSize,
      pageIndex: props.pageIndex,
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
      const oldPageInfo = table.getState().pagination;

      const newPageInfo = updater(oldPageInfo);

      if (props.onRequestPaginationChange) {
        props.onRequestPaginationChange(newPageInfo, oldPageInfo);
      }
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
                      {!header.isPlaceholder &&
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      }

                      {/*
                        TODO: if we ever see performance issues while resizing,
                        there is a way to fix that, see:
                        https://tanstack.com/table/latest/docs/guide/column-sizing#advanced-column-resizing-performance
                      */}
                      <div
                        onDoubleClick={() => header.column.resetSize()}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cx(styles.resizer, {
                          [styles.isResizing]: header.column.getIsResizing(),
                        })}
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
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasPagination && (
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
              options={(props.pageSizes || []).map((pageSize) => {
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
