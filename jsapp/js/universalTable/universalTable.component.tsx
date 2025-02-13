// Libraries
import type React from 'react';
import {useState, useRef, useCallback, type CSSProperties, useEffect} from 'react';
import cx from 'classnames';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type CellContext,
  type Column,
  type PaginationState,
  type TableOptions,
  type ColumnPinningPosition,
} from '@tanstack/react-table';
import {useViewportSize} from 'jsapp/js/hooks/useViewportSize';

// Partial components
import LoadingSpinner from 'js/components/common/loadingSpinner';
import Button from 'js/components/common/button';
import KoboSelect from 'js/components/common/koboSelect';

// Utilities
import {generateUuid} from 'js/utils';

// Styles
import styles from './universalTable.module.scss';

export interface UniversalTableColumn<DataItem> {
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
  isPinned?: ColumnPinningPosition;
  /**
   * This is override for the default width of a column. Use it if you need more
   * space for your data, or if you display something very short.
   */
  size?: number;
  /**
   * This is an optional formatter function that will be used when rendering
   * the cell value. Without it a literal text value will be rendered. For more
   * flexibility, function receives whole original data object.
   */
  cellFormatter?: (value: DataItem, rowIndex: number) => React.ReactNode;
}

interface UniversalTableProps<DataItem> {
  /** A list of column definitions */
  columns: Array<UniversalTableColumn<DataItem>>;
  data: DataItem[];
  /**
   * When set to `true`, a spinner with overlay will be displayed over the table
   * rows.
   */
  isSpinnerVisible?: boolean;
  // PAGINATION
  // To see footer with pagination you need to pass all these below:
  /** Starts with `0` */
  pageIndex?: number;
  /** Total number of pages of data. */
  pageCount?: number;
  /**
   * One of `pageSizeOptions`. It is de facto the `limit` from the `offset` and
   * `limit` pair used for paginating the endpoint.
   */
  pageSize?: number;
  pageSizeOptions?: number[];
  /**
   * A way for the table to say "user wants to change pagination". It's being
   * triggered for both page navigation and page size changes.
   *
   * Provides an object with current `pageIndex` and `pageSize` (one or both
   * values are new). The second object shows previous pagination, use it to
   * compare and understand what has happened :)
   */
  onRequestPaginationChange?: (
    newPageInfo: PaginationState,
    oldPageInfo: PaginationState
  ) => void;
  // ENDPAGINATION
}

const DEFAULT_COLUMN_SIZE = {
  size: 200, // starting column size
  minSize: 60, // enforced during column resizing
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
  // We need table height for the resizers
  const [tableHeight, setTableHeight] = useState(0);
  const [hasHorizontalScrollbar, setHasHorizontalScrollbar] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const tableContainerRef = useRef<HTMLTableElement>(null);
  const {width, height} = useViewportSize();

  const moveCallback = useCallback(() => {
    if (tableRef.current) {
      setTableHeight(tableRef.current.clientHeight);
    }
  }, []);

  function onResizerStart() {
    document.addEventListener('mousemove', moveCallback);
    document.addEventListener('touchmove', moveCallback);
  }

  function onResizerEnd() {
    document.removeEventListener('mousemove', moveCallback);
    document.removeEventListener('touchmove', moveCallback);
  }

  function getCommonClassNames(column: Column<DataItem>) {
    const isPinned = column.getIsPinned();
    return cx({
      [styles.isPinnedLeft]: isPinned === 'left',
      [styles.isPinnedRight]: isPinned === 'right',
      [styles.isLastLeftPinnedColumn]: isPinned === 'left' && column.getIsLastColumn('left'),
      [styles.isFirstRightPinnedColumn]: isPinned === 'right' && column.getIsFirstColumn('right'),
    });
  }

  function getCommonColumnStyles(column: Column<DataItem>): CSSProperties {
    const isPinned = column.getIsPinned();
    return {
      left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
      right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
      width: `${column.getSize()}px`,
    };
  }

  const columns = props.columns.map((columnDef) => {
    return {
      accessorKey: columnDef.key,
      header: () => columnDef.label,
      cell: (cellProps: CellContext<DataItem, string>) => {
        if (columnDef.cellFormatter) {
          return columnDef.cellFormatter(
            cellProps.row.original,
            cellProps.row.index
          );
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
    // Override default column sizing
    defaultColumn: DEFAULT_COLUMN_SIZE,
  };

  // Set separately because we set both `.columnPinning` and (sometimes)
  // `.pagination` and we need to be careful not to overwrite `.state` object.
  options.state = {};

  options.state.columnPinning = {
    left: props.columns.filter((col) => col.isPinned === 'left').map((col) => col.key),
    right: props.columns.filter((col) => col.isPinned === 'right').map((col) => col.key),
  };

  const hasPagination = Boolean(
    props.pageIndex !== undefined &&
    props.pageCount &&
    props.pageSize &&
    props.pageSizeOptions &&
    props.onRequestPaginationChange
  );

  // Add pagination related options if needed
  if (
    hasPagination &&
    // `hasPagination` handles everything, but we need these two for TypeScript:
    props.pageSize &&
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

  // Calculate the total width of all columns and the width of container, to
  // guess if there is a horizontal scrollbar
  useEffect(() => {
    const columnsWidth = table.getTotalSize();
    let containerWidth = Infinity;
    if (tableContainerRef.current) {
      containerWidth = tableContainerRef.current.offsetWidth;
    }

    setHasHorizontalScrollbar(columnsWidth > containerWidth);
  }, [props, table, width, height]);

  return (
    <div className={cx(styles.universalTableRoot, {
      [styles.hasHorizontalScrollbar]: hasHorizontalScrollbar,
    })}>
      <div className={styles.tableContainer} ref={tableContainerRef}>
        {props.isSpinnerVisible &&
          <div className={styles.spinnerOverlay}>
            <LoadingSpinner message={false} />
          </div>
        }

        <table
          className={styles.table}
          style={{width: table.getTotalSize()}}
          ref={tableRef}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cx(
                      styles.tableHeaderCell,
                      getCommonClassNames(header.column)
                    )}
                    style={{...getCommonColumnStyles(header.column)}}
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
                    {/*
                      TODO: one of the resizers will not work for columns that
                      are `isLastLeftPinnedColumn` or `isFirstRightPinnedColumn`
                      and we are ok with this for now.
                    */}
                    <div
                      onDoubleClick={() => header.column.resetSize()}
                      onMouseDown={(event) => {
                        onResizerStart();
                        header.getResizeHandler()(event);
                      }}
                      onTouchStart={(event) => {
                        onResizerStart();
                        header.getResizeHandler()(event);
                      }}
                      onMouseUp={() => {onResizerEnd();}}
                      onTouchEnd={() => {onResizerEnd();}}
                      className={cx(styles.resizer, {
                        [styles.isResizing]: header.column.getIsResizing(),
                      })}
                    >
                      {header.column.getIsResizing() &&
                        <span
                          className={styles.resizerLine}
                          style={{height: `${tableHeight}px`}}
                        />
                      }
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cx(
                      styles.tableCell,
                      getCommonClassNames(cell.column)
                    )}
                    style={{...getCommonColumnStyles(cell.column)}}
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
            options={(props.pageSizeOptions || []).map((pageSize) => {
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
  );
}
