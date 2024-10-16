import React from 'react';
import ReactDOM from 'react-dom';
import PopoverMenu from 'js/popoverMenu';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import bem, {makeBem} from 'js/bem';
import {
  hasVerticalScrollbar,
  getScrollbarWidth,
} from 'js/utils';
import AssetsTableRow from './assetsTableRow';
import {
  ASSETS_TABLE_CONTEXTS,
  ORDER_DIRECTIONS,
  ASSETS_TABLE_COLUMNS,
} from './assetsTableConstants';
import type {
  AssetsTableContextName,
  AssetsTableColumn,
} from './assetsTableConstants';
import type {OrderDirection} from 'js/projects/projectViews/constants';
import type {
  AssetResponse,
  MetadataResponse,
} from 'js/dataInterface';
import './assetsTable.scss';
import Button from 'js/components/common/button';

bem.AssetsTable = makeBem(null, 'assets-table');
bem.AssetsTable__header = makeBem(bem.AssetsTable, 'header');
bem.AssetsTable__body = makeBem(bem.AssetsTable, 'body');
bem.AssetsTable__footer = makeBem(bem.AssetsTable, 'footer');
bem.AssetsTableRow = makeBem(null, 'assets-table-row');
bem.AssetsTableRow__link = makeBem(bem.AssetsTableRow, 'link', 'a');
bem.AssetsTableRow__buttons = makeBem(bem.AssetsTableRow, 'buttons');
bem.AssetsTableRow__column = makeBem(bem.AssetsTableRow, 'column');
bem.AssetsTableRow__headerLabel = makeBem(bem.AssetsTableRow, 'header-label', 'span');
bem.AssetsTableRow__tags = makeBem(bem.AssetsTableRow, 'tags', 'div');
bem.AssetsTableRow__tag = makeBem(bem.AssetsTableRow, 'tag', 'span');
bem.AssetsTablePagination = makeBem(null, 'assets-table-pagination');

type OrderChangeCallback = (columnId: string, columnValue: OrderDirection) => void;
type FilterChangeCallback = (columnId: string | null, columnValue: string | null) => void;
type SwitchPageCallback = (pageNumber: number) => void;

interface AssetsTableProps {
 context: AssetsTableContextName;
 /** Displays a spinner */
 isLoading?: boolean;
 /** To display contextual empty message when zero assets. */
 emptyMessage?: React.ReactNode;
 /** List of assets to be displayed. */
 assets: AssetResponse[];
 /** Number of assets on all pages. */
 totalAssets: number | null;
 /** List of available filters values. */
 metadata?: MetadataResponse; // this type ??
 /** Seleceted order column id, one of ASSETS_TABLE_COLUMNS. */
 orderColumnId: string;
 /** Seleceted order column value. Defaults to "ascending" */
 orderValue: OrderDirection | null;
 /** Called when user selects a column for odering. */
 onOrderChange: OrderChangeCallback;
 /** Seleceted filter column, one of ASSETS_TABLE_COLUMNS. */
 filterColumnId: string | null;
 /** Seleceted filter column value. */
 filterValue: string | null;
 /** Called when user selects a column for filtering. */
 onFilterChange: FilterChangeCallback;
 /**
  * For displaying pagination. If you omit any of these, pagination will simply
  * not be rendered. Good to use when you actually don't need it.
  */
 currentPage?: number;
 totalPages?: number;
 /** Called when user clicks page change. */
 onSwitchPage?: SwitchPageCallback;
}

interface AssetsTableState {
  shouldHidePopover: boolean;
  isPopoverVisible: boolean;
  scrollbarWidth: number | null;
  isFullscreen: boolean;
}

/**
 * Displays a table of assets. This old-ish component is handling three routes:
 * - My Library
 * - Public Collections
 * - Single Collection
 * The new and shiny component that handles Projects List is `ProjectsTable`,
 * and in the future it should become (if possible) the only one to be used.
 *
 * @deprecated There is no clear replacement as of yet. We have a better
 * `ProjectsTable` component, but ultimately wa are aiming at using
 * `react-table` more. See `UniversalTable` for the possible "final" way of
 * handling tables.
 */
export default class AssetsTable extends React.Component<
  AssetsTableProps,
  AssetsTableState
> {
  constructor(props: AssetsTableProps){
    super(props);
    this.state = {
      shouldHidePopover: false,
      isPopoverVisible: false,
      scrollbarWidth: null,
      isFullscreen: false,
    };
    this.bodyRef = React.createRef();
  }

  private updateScrollbarWidthBound = this.updateScrollbarWidth.bind(this);

  bodyRef: React.RefObject<any>;

  componentDidMount() {
    this.updateScrollbarWidth();
    window.addEventListener('resize', this.updateScrollbarWidthBound);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateScrollbarWidthBound);
  }

  componentDidUpdate(prevProps: AssetsTableProps) {
    if (prevProps.isLoading !== this.props.isLoading) {
      this.updateScrollbarWidth();
    }
  }

  toggleFullscreen() {
    this.setState({isFullscreen: !this.state.isFullscreen});
  }

  updateScrollbarWidth() {
    const bodyNode = ReactDOM.findDOMNode(this.bodyRef?.current) as HTMLElement;
    if (bodyNode && hasVerticalScrollbar(bodyNode)) {
      this.setState({scrollbarWidth: getScrollbarWidth()});
    } else {
      this.setState({scrollbarWidth: null});
    }
  }

  switchPage(newPageNumber: number) {
    if (this.props.onSwitchPage) {
      this.props.onSwitchPage(newPageNumber);
    }
  }

  /**
   * This function is only a callback handler, as the asset reordering itself
   * should be handled by the component that is providing the assets list.
   */
  onChangeOrder(columnId: string) {
    if (this.props.orderColumnId === columnId) {
      // clicking already selected column results in switching the order direction
      let newVal = null;
      if (this.props.orderValue === ORDER_DIRECTIONS.ascending) {
        newVal = ORDER_DIRECTIONS.descending;
      } else {
        newVal = ORDER_DIRECTIONS.ascending;
      }
      this.props.onOrderChange(this.props.orderColumnId, newVal);
    } else {
      // change column and revert order direction to default
      this.props.onOrderChange(columnId, ASSETS_TABLE_COLUMNS[columnId].defaultValue || ORDER_DIRECTIONS.ascending);
    }
  }

  /**
   * This function is only a callback handler, as the asset filtering itself
   * should be handled by the component that is providing the assets list.
   */
  onChangeFilter(columnId: string, filterValue: string | null = null) {
    if (
      this.props.filterColumnId === columnId &&
      this.props.filterValue === filterValue
    ) {
      // when clicking already selected item, clear it
      this.props.onFilterChange(null, null);
    } else {
      this.props.onFilterChange(columnId, filterValue);
    }
  }

  onClearFilter(evt: React.MouseEvent | React.TouchEvent) {
    evt.stopPropagation();
    this.props.onFilterChange(null, null);
  }

  renderHeader(columnDef: AssetsTableColumn) {
    if (columnDef.orderBy) {
      return this.renderOrderableHeader(columnDef);
    } else if (columnDef.filterBy) {
      return this.renderFilterableHeader(columnDef);
    } else {
      let displayLabel = columnDef.label;
      if (
        columnDef.id === ASSETS_TABLE_COLUMNS['items-count'].id &&
        this.props.context === ASSETS_TABLE_CONTEXTS.COLLECTION_CONTENT
      ) {
        displayLabel = t('Questions');
      }
      return (
        <bem.AssetsTableRow__column m={columnDef.id} disabled>
          {displayLabel}
        </bem.AssetsTableRow__column>
      );
    }
  }

  onPopoverSetVisible() {
    this.setState({isPopoverVisible: true});
  }

  getColumnMetadata(columnDef: AssetsTableColumn) {
    switch (columnDef.filterByMetadataName) {
      case 'languages':
        return this.props.metadata?.languages || [];
      case 'countries':
        return this.props.metadata?.countries || [];
      case 'sectors':
        return this.props.metadata?.sectors || [];
      case 'organizations':
        return this.props.metadata?.organizations || [];
      default:
        return [];
    }
  }

  renderFilterableHeader(columnDef: AssetsTableColumn) {
    const options = this.getColumnMetadata(columnDef);

    if (options.length === 0) {
      return (
        <bem.AssetsTableRow__column m={columnDef.id} disabled>
          {columnDef.label}
        </bem.AssetsTableRow__column>
      );
    }

    let icon = (<i className='k-icon k-icon-filter-arrows'/>);
    if (this.props.filterColumnId === columnDef.id) {
      icon = (<i className='k-icon k-icon-close' onClick={this.onClearFilter.bind(this)}/>);
    }

    return (
      <bem.AssetsTableRow__column m={columnDef.id}>
        <PopoverMenu
          type='assets-table'
          triggerLabel={<span>{columnDef.label} {icon}</span>}
          clearPopover={this.state.shouldHidePopover}
          popoverSetVisible={this.onPopoverSetVisible.bind(this)}
        >
          {options.map((option, index) => {
            let optionValue;
            let optionLabel;

            if (typeof option === 'string') {
              optionValue = option;
              optionLabel = option;
            }
            if (Array.isArray(option)) {
              optionValue = option[0];
              optionLabel = option[1];
            }

            return (
              <bem.PopoverMenu__link
                onClick={this.onChangeFilter.bind(this, columnDef.id, optionValue)}
                key={`option-${index}`}
              >
                {optionLabel}
                {optionValue === this.props.filterValue &&
                  <i className='k-icon k-icon-check'/>
                }
              </bem.PopoverMenu__link>
            );
          })}
        </PopoverMenu>
      </bem.AssetsTableRow__column>
    );
  }

  renderOrderableHeader(columnDef: AssetsTableColumn) {
    let hideIcon = false;
    let hideLabel = false;

    // for `icon-status` we don't display empty icon, because the column is
    // too narrow to display label and icon together
    if (columnDef.id === ASSETS_TABLE_COLUMNS['icon-status'].id) {
      hideIcon = this.props.orderColumnId !== columnDef.id;
      hideLabel = this.props.orderColumnId === columnDef.id;
    }

    // empty icon to take up space in column
    let icon = (<i className='k-icon'/>);
    if (this.props.orderColumnId === columnDef.id) {
      if (this.props.orderValue === ORDER_DIRECTIONS.ascending) {
        icon = (<i className='k-icon k-icon-angle-up'/>);
      }
      if (this.props.orderValue === ORDER_DIRECTIONS.descending) {
        icon = (<i className='k-icon k-icon-angle-down'/>);
      }
    }

    return (
      <bem.AssetsTableRow__column
        m={columnDef.id}
        onClick={this.onChangeOrder.bind(this, columnDef.id)}
      >
        {!hideLabel &&
          <bem.AssetsTableRow__headerLabel>{columnDef.label}</bem.AssetsTableRow__headerLabel>
        }
        {!hideIcon && icon}
      </bem.AssetsTableRow__column>
    );
  }

  /**
   * Safe: returns nothing if pagination properties are not set.
   */
  renderPagination() {
    if (
      // Note that `currentPage` and `totalPages` might be `0`
      typeof this.props.currentPage === 'number' &&
      typeof this.props.totalPages === 'number' &&
      typeof this.props.onSwitchPage === 'function'
    ) {
      const naturalCurrentPage = this.props.currentPage + 1;
      return (
        <bem.AssetsTablePagination>
          <Button
            type='text'
            size='s'
            startIcon='angle-left'
            label={t('Previous')}
            isDisabled={this.props.currentPage === 0}
            onClick={this.switchPage.bind(this, this.props.currentPage - 1)}
          />

          <span>
            {/* we avoid displaying 1/0 as it doesn't make sense to humans */}
            {naturalCurrentPage}/{this.props.totalPages || 1}
          </span>

          <Button
            type='text'
            size='s'
            endIcon='angle-right'
            label={t('Next')}
            isDisabled={naturalCurrentPage >= this.props.totalPages}
            onClick={this.switchPage.bind(this, this.props.currentPage + 1)}
          />
        </bem.AssetsTablePagination>
      );
    } else {
      return null;
    }
  }

  renderFooter() {
    return (
      <bem.AssetsTable__footer>
        {this.props.totalAssets !== null &&
          <span>
            {t('##count## items').replace('##count##', String(this.props.totalAssets))}
          </span>
        }

        {this.renderPagination()}

        {this.props.totalAssets !== null &&
          <Button
            type='text'
            size='s'
            endIcon='expand'
            label={t('Toggle fullscreen')}
            onClick={this.toggleFullscreen.bind(this)}
          />
        }
      </bem.AssetsTable__footer>
    );
  }

  render() {
    const modifiers: string[] = [this.props.context];
    if (this.state.isFullscreen) {
      modifiers.push('fullscreen');
    }

    return (
      <bem.AssetsTable m={modifiers}>
        <bem.AssetsTable__header>
          <bem.AssetsTableRow m='header'>
            {this.renderHeader(ASSETS_TABLE_COLUMNS['icon-status'])}
            {this.renderHeader(ASSETS_TABLE_COLUMNS.name)}
            {this.renderHeader(ASSETS_TABLE_COLUMNS['items-count'])}
            {this.renderHeader(ASSETS_TABLE_COLUMNS.owner)}
            {this.props.context === ASSETS_TABLE_CONTEXTS.PUBLIC_COLLECTIONS &&
              this.renderHeader(ASSETS_TABLE_COLUMNS['subscribers-count'])
            }
            {this.renderHeader(ASSETS_TABLE_COLUMNS.languages)}
            {this.props.context === ASSETS_TABLE_CONTEXTS.PUBLIC_COLLECTIONS &&
              this.renderHeader(ASSETS_TABLE_COLUMNS['primary-sector'])
            }
            {this.renderHeader(ASSETS_TABLE_COLUMNS['date-modified'])}

            {this.state.scrollbarWidth !== 0 && this.state.scrollbarWidth !== null &&
              <div
                className='assets-table__scrollbar-padding'
                style={{width: `${this.state.scrollbarWidth}px`}}
              />
            }
          </bem.AssetsTableRow>
        </bem.AssetsTable__header>

        <bem.AssetsTable__body ref={this.bodyRef}>
          {this.props.isLoading &&
            <LoadingSpinner/>
          }

          {!this.props.isLoading && this.props.assets.length === 0 &&
            <bem.AssetsTableRow m='empty-message'>
              {this.props.emptyMessage || t('There are no assets to display.')}
            </bem.AssetsTableRow>
          }

          {!this.props.isLoading && this.props.assets.map((asset) =>
            <AssetsTableRow
              asset={asset}
              key={asset.uid}
              context={this.props.context}
            />
          )}
        </bem.AssetsTable__body>

        {this.renderFooter()}
      </bem.AssetsTable>
    );
  }
}
