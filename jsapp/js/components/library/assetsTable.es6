import React from 'react';
import ReactDOM from 'react-dom';
import autoBind from 'react-autobind';
import PopoverMenu from 'js/popoverMenu';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import bem from 'js/bem';
import {
  hasVerticalScrollbar,
  getScrollbarWidth,
} from 'utils';
import AssetsTableRow from './assetsTableRow';
import {
  ASSETS_TABLE_CONTEXTS,
  ORDER_DIRECTIONS,
  ASSETS_TABLE_COLUMNS,
} from './libraryConstants';
import './assetsTable.scss';

/**
 * Displays a table of assets.
 *
 * @prop {string} context - One of ASSETS_TABLE_CONTEXTS.
 * @prop {boolean} [isLoading] - To display spinner.
 * @prop {string} [emptyMessage] - To display contextual empty message when zero assets.
 * @prop {Array<object>} assets - List of assets to be displayed.
 * @prop {number} totalAssets - Number of assets on all pages.
 * @prop {Array<object>} metadata - List of available filters values.
 * @prop {string} orderColumnId - Seleceted order column id, one of ASSETS_TABLE_COLUMNS.
 * @prop {string} orderValue - Seleceted order column value.
 * @prop {columnChangeCallback} onOrderChange - Called when user selects a column for odering.
 * @prop {string} filterColumnId - Seleceted filter column, one of ASSETS_TABLE_COLUMNS.
 * @prop {string} filterValue - Seleceted filter column value.
 * @prop {columnChangeCallback} onFilterChange - Called when user selects a column for filtering.
 * @prop {number} [currentPage] - For displaying pagination.
 * @prop {number} [totalPages] - For displaying pagination.
 * @prop {switchPageCallback} [onSwitchPage] - Called when user clicks page change.
 */
export default class AssetsTable extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      shouldHidePopover: false,
      isPopoverVisible: false,
      scrollbarWidth: null,
      isFullscreen: false
    };
    this.bodyRef = React.createRef();
    autoBind(this);
  }

  componentDidMount() {
    this.updateScrollbarWidth();
    window.addEventListener('resize', this.updateScrollbarWidth);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateScrollbarWidth);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.isLoading !== this.props.isLoading) {
      this.updateScrollbarWidth();
    }
  }

  toggleFullscreen() {
    this.setState({isFullscreen: !this.state.isFullscreen});
  }

  updateScrollbarWidth() {
    if (
      this.bodyRef &&
      this.bodyRef.current &&
      hasVerticalScrollbar(ReactDOM.findDOMNode(this.bodyRef.current))
    ) {
      this.setState({scrollbarWidth: getScrollbarWidth()});
    } else {
      this.setState({scrollbarWidth: null});
    }
  }

  /**
   * @param {number} newPageNumber
   */
  switchPage(newPageNumber) {
    this.props.onSwitchPage(newPageNumber);
  }

  /**
   * This function is only a callback handler, as the asset reordering itself
   * should be handled by the component that is providing the assets list.
   * @param {string} columnId
   */
  onChangeOrder(columnId) {
    if (this.props.orderColumnId === columnId) {
      // clicking already selected column results in switching the order direction
      let newVal;
      if (this.props.orderValue === ORDER_DIRECTIONS.ascending) {
        newVal = ORDER_DIRECTIONS.descending;
      } else if (this.props.orderValue === ORDER_DIRECTIONS.descending) {
        newVal = ORDER_DIRECTIONS.ascending;
      }
      this.props.onOrderChange(this.props.orderColumnId, newVal);
    } else {
      // change column and revert order direction to default
      this.props.onOrderChange(columnId, ASSETS_TABLE_COLUMNS[columnId].defaultValue);
    }
  }

  /**
   * This function is only a callback handler, as the asset filtering itself
   * should be handled by the component that is providing the assets list.
   * @param {string} columnId
   * @param {string} filterValue
   */
  onChangeFilter(columnId, filterValue) {
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

  onClearFilter(evt) {
    evt.stopPropagation();
    this.props.onFilterChange(null, null);
  }

  /**
   * @param {AssetsTableColumn} columnDef - Given column definition.
   * @param {string} [option] - Currently either 'first' or 'last'.
   */
  renderHeader(columnDef, option) {
    if (columnDef.orderBy) {
      return this.renderOrderableHeader(columnDef, option);
    } else if (columnDef.filterBy) {
      return this.renderFilterableHeader(columnDef, option);
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

  onMouseLeave() {
    // force hide popover in next render cycle
    // (PopoverMenu interface handles it this way)
    if (this.state.isPopoverVisible) {
      this.setState({shouldHidePopover: true});
    }
  }

  onPopoverSetVisible() {
    this.setState({isPopoverVisible: true});
  }

  renderFilterableHeader(columnDef) {
    let options = [];
    if (this.props.metadata[columnDef.filterByMetadataName]) {
      options = this.props.metadata[columnDef.filterByMetadataName];
    }

    if (options.length === 0) {
      return (
        <bem.AssetsTableRow__column m={columnDef.id} disabled>
          {columnDef.label}
        </bem.AssetsTableRow__column>
      );
    }

    let icon = (<i className='k-icon k-icon-filter-arrows'/>);
    if (this.props.filterColumnId === columnDef.id) {
      icon = (<i className='k-icon k-icon-close' onClick={this.onClearFilter}/>);
    }

    return (
      <bem.AssetsTableRow__column m={columnDef.id}>
        <PopoverMenu
          type='assets-table'
          triggerLabel={<span>{columnDef.label} {icon}</span>}
          clearPopover={this.state.shouldHidePopover}
          popoverSetVisible={this.onPopoverSetVisible}
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

  renderOrderableHeader(columnDef) {
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
        icon = (<i className='k-icon k-icon-up'/>);
      }
      if (this.props.orderValue === ORDER_DIRECTIONS.descending) {
        icon = (<i className='k-icon k-icon-down'/>);
      }
    }

    const classNames = [];

    return (
      <bem.AssetsTableRow__column
        m={columnDef.id}
        onClick={this.onChangeOrder.bind(this, columnDef.id)}
        classNames={classNames}
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
    const hasPagination = (
      typeof this.props.currentPage === 'number' &&
      typeof this.props.totalPages === 'number' &&
      typeof this.props.onSwitchPage === 'function'
    );
    const naturalCurrentPage = this.props.currentPage + 1;

    if (hasPagination) {
      return (
        <bem.AssetsTablePagination>
          <bem.AssetsTablePagination__button
            disabled={this.props.currentPage === 0}
            onClick={this.switchPage.bind(this, this.props.currentPage - 1)}
          >
            <i className='k-icon k-icon-prev'/>
            {t('Previous')}
          </bem.AssetsTablePagination__button>

          <bem.AssetsTablePagination__index>
            {/* we avoid displaying 1/0 as it doesn't make sense to humans */}
            {naturalCurrentPage}/{this.props.totalPages || 1}
          </bem.AssetsTablePagination__index>

          <bem.AssetsTablePagination__button
            disabled={naturalCurrentPage >= this.props.totalPages}
            onClick={this.switchPage.bind(this, this.props.currentPage + 1)}
          >
            {t('Next')}
            <i className='k-icon k-icon-next'/>
          </bem.AssetsTablePagination__button>
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
            {t('##count## items').replace('##count##', this.props.totalAssets)}
          </span>
        }

        {this.renderPagination()}

        {this.props.totalAssets !== null &&
          <button
            className='mdl-button'
            onClick={this.toggleFullscreen}
          >
            {t('Toggle fullscreen')}
            <i className='k-icon k-icon-expand' />
          </button>
        }
      </bem.AssetsTable__footer>
    );
  }

  render() {
    const modifiers = [this.props.context];
    if (this.state.isFullscreen) {
      modifiers.push('fullscreen');
    }

    return (
      <bem.AssetsTable m={modifiers}>
        <bem.AssetsTable__header>
          <bem.AssetsTableRow m='header'>
            {this.renderHeader(ASSETS_TABLE_COLUMNS['icon-status'], 'first')}
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
            {this.renderHeader(ASSETS_TABLE_COLUMNS['date-modified'], 'last')}

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

          {!this.props.isLoading && this.props.assets.map((asset) => {
            return (
              <AssetsTableRow
                asset={asset}
                key={asset.uid}
                context={this.props.context}
              />
            );
          })}
        </bem.AssetsTable__body>

        {this.renderFooter()}
      </bem.AssetsTable>
    );
  }
}

/**
 * @callback columnChangeCallback
 * @param {string} columnId
 * @param {string} columnValue
 */

/**
 * @callback switchPageCallback
 * @param {string} pageNumber
 */
