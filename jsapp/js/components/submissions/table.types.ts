import type {Column} from 'react-table';
import type {
  SurveyRow,
  SubmissionResponse,
} from 'js/dataInterface';

export type SubmissionPageName = 'next' | 'prev';

// TODO: there might be some more properties here
export interface TableColumn extends Column<SubmissionResponse> {
  id: string;
  /** For ordering columns in the table */
  index: string;
  question?: SurveyRow;
}

export interface DataTableSelectedRows {
  /**
   * This is a map of `submissionUid`s of selected rows, each pointing towards
   * "is selected" boolean.
   */
  [sid: string]: boolean
};

// These are the missing typings for the `react-table` needed in DataTable
// component. Most of the things are left undiscovered, as I relied on
// `console.log` output, and didn't need most of these.

interface ReactTableStateColumn {
  Aggregated?: Function;
  Cell?: Function;
  Expander?: Function;
  Filter?: Function;
  Footer?: Function;
  Header?: Function;
  Pivot?: Function;
  PivotValue?: Function;
  Placeholder?: Function;
  accessor: any;
  aggregate: any;
  className: string;
  filterAll: boolean;
  filterMethod: any;
  filterable: boolean;
  footerClassName: string;
  footerStyle: {};
  getFooterProps: Function;
  getHeaderProps: Function;
  getProps: Function;
  headerClassName: string;
  headerStyle: {};
  id: string;
  index: string;
  minResizeWidth: number;
  minWidth: number;
  resizable: boolean;
  show: boolean;
  sortMethod: any;
  sortable: boolean;
  style: {};
  width: number;
}

export interface ReactTableStateFilteredItem {
  id: string;
  value: string;
}

export interface ReactTableState {
  AggregatedComponent?: Function;
  ExpanderComponent?: Function;
  FilterComponent?: Function;
  LoadingComponent?: Function;
  NoDataComponent?: Function;
  PadRowComponent?: Function;
  PaginationComponent?: Function;
  PivotValueComponent?: Function;
  ResizerComponent?: Function;
  TableComponent?: Function;
  TbodyComponent?: Function;
  TdComponent?: Function;
  TfootComponent?: Function;
  ThComponent?: Function;
  TheadComponent?: Function;
  TrComponent?: Function;
  TrGroupComponent?: Function;
  aggregatedKey: string;
  allDecoratedColumns: ReactTableStateColumn[];
  allVisibleColumns: ReactTableStateColumn[];
  className: string;
  collapseOnDataChange: boolean;
  collapseOnPageChange: boolean;
  collapseOnSortingChange: boolean;
  column: ReactTableStateColumn;
  columns: ReactTableStateColumn[];
  currentlyResizing: boolean;
  data: SubmissionResponse[];
  defaultExpanded: {};
  defaultFilterMethod: Function;
  defaultFiltered: any[];
  defaultPage: number;
  defaultPageSize: number;
  defaultResized: any[];
  defaultSortDesc: boolean;
  defaultSortMethod: Function;
  defaultSorted: any[];
  expanded: {};
  expanderDefaults: {
    filterable: boolean;
    resizable: boolean;
    sortable: boolean;
    width: 35;
  };
  filterable: boolean;
  filtered: ReactTableStateFilteredItem[];
  freezeWhenExpanded: boolean;
  frozen: boolean;
  getLoadingProps: Function;
  getNoDataProps: Function;
  getPaginationProps: Function;
  getProps: Function;
  getResizerProps: Function;
  getTableProps: Function;
  getTbodyProps: Function;
  getTdProps: Function;
  getTfootProps: Function;
  getTfootTdProps: Function;
  getTfootTrProps: Function;
  getTheadFilterProps: Function;
  getTheadFilterThProps: Function;
  getTheadFilterTrProps: Function;
  getTheadGroupProps: Function;
  getTheadGroupThProps: Function;
  getTheadGroupTrProps: Function;
  getTheadProps: Function;
  getTheadThProps: Function;
  getTheadTrProps: Function;
  getTrGroupProps: Function;
  getTrProps: Function;
  groupedByPivotKey: string;
  hasHeaderGroups: boolean;
  headerGroups: any[];
  indexKey: string;
  loading: boolean;
  loadingText: any;
  manual: boolean;
  minRows: number;
  multiSort: boolean;
  nestingLevelKey: string;
  nextText: any;
  noDataText: string;
  ofText: string;
  onFetchData: Function;
  originalKey: string;
  page: number;
  pageJumpText: string;
  pageSize: number;
  pageSizeOptions: number[];
  pageText: string;
  pages: number;
  pivotDefaults: {};
  pivotIDKey: string;
  pivotValKey: string;
  previousText: any;
  resizable: boolean;
  resized: any[];
  resolveData: Function;
  resolvedData: SubmissionResponse[];
  rowsSelectorText: string;
  rowsText: string;
  showPageJump: boolean;
  showPageSizeOptions: boolean;
  showPagination: boolean;
  showPaginationBottom: boolean;
  showPaginationTop: boolean;
  skipNextSort: boolean;
  sortable: boolean;
  sorted: any[];
  sortedData: SubmissionResponse[];
  style: {};
  subRowsKey: string;
}

export interface ReactTableInstance {
  _reactInternalFiber: any;
  context: {};
  filterColumn: Function;
  filterData: Function;
  fireFetchData: Function;
  getDataModel: Function;
  getMinRows: Function;
  getPropOrState: Function;
  getResolvedState: Function;
  getSortedData: Function;
  getStateOrProp: Function;
  onPageChange: Function;
  onPageSizeChange: Function;
  props: ReactTableState;
  refs: {};
  resizeColumnEnd: Function;
  resizeColumnMoving: Function;
  resizeColumnStart: Function;
  resolvedData: SubmissionResponse[];
  sortColumn: Function;
  sortData: Function;
  state: ReactTableState;
  updater: any;
  /** Internal function. You can pass any of `ReactTableState` properties. */
  setState: (params: any) => void;
}
