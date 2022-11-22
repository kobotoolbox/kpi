import React from 'react';
import ReactDOM from 'react-dom';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import bem, {makeBem} from 'js/bem';
import {
  hasVerticalScrollbar,
  getScrollbarWidth,
} from 'js/utils';
import ProjectsTableRow from './projectsTableRow';
import type {ProjectFieldName, OrderDirection} from 'js/components/projectsView/projectsViewConstants';
import {PROJECT_FIELDS} from 'js/components/projectsView/projectsViewConstants';
import ProjectsTableHeader from './projectsTableHeader';
import type {AssetResponse} from 'js/dataInterface';
import './projectsTable.scss';

bem.ProjectsTable = makeBem(null, 'projects-table');
bem.ProjectsTable__header = makeBem(bem.ProjectsTable, 'header');
bem.ProjectsTable__body = makeBem(bem.ProjectsTable, 'body');
bem.ProjectsTable__footer = makeBem(bem.ProjectsTable, 'footer');
bem.ProjectsTableRow = makeBem(null, 'projects-table-row');
bem.ProjectsTableRow__link = makeBem(bem.ProjectsTableRow, 'link', 'a');
bem.ProjectsTableRow__buttons = makeBem(bem.ProjectsTableRow, 'buttons');
bem.ProjectsTableRow__column = makeBem(bem.ProjectsTableRow, 'column');
bem.ProjectsTableRow__headerLabel = makeBem(bem.ProjectsTableRow, 'header-label', 'span');
bem.ProjectsTableRow__tags = makeBem(bem.ProjectsTableRow, 'tags', 'div');
bem.ProjectsTableRow__tag = makeBem(bem.ProjectsTableRow, 'tag', 'span');
bem.ProjectsTablePagination = makeBem(null, 'projects-table-pagination');
bem.ProjectsTablePagination__button = makeBem(bem.ProjectsTablePagination, 'button', 'button');
bem.ProjectsTablePagination__index = makeBem(bem.ProjectsTablePagination, 'index');

interface ProjectsTableProps {
 /** Displays a spinner */
 isLoading?: boolean;
 /** To display contextual empty message when zero assets. */
 emptyMessage?: string;
 /** List of assets to be displayed. */
 assets: AssetResponse[];
 /** Number of assets on all pages. */
 totalAssets: number;
 /** Seleceted order column id, one of ASSETS_TABLE_COLUMNS. */
 orderFieldName: ProjectFieldName;
 /** Seleceted order column value. */
 orderDirection: OrderDirection;
 /** Called when user selects a column for odering. */
 onOrderChangeRequested: (fieldName: string, direction: OrderDirection) => void;
 /**
  * For displaying pagination. If you omit any of these, pagination will simply
  * not be rendered. Good to use when you actually don't need it.
  */
 currentPage?: number;
 totalPages?: number;
 /** Called when user clicks page change. */
 onSwitchPage?: (pageNumber: number) => void;
}

interface ProjectsTableState {
  shouldHidePopover: boolean;
  isPopoverVisible: boolean;
  scrollbarWidth: number | null;
  isFullscreen: boolean;
}

/**
 * Displays a table of assets.
 */
export default class ProjectsTable extends React.Component<
  ProjectsTableProps,
  ProjectsTableState
> {
  constructor(props: ProjectsTableProps){
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

  componentDidUpdate(prevProps: ProjectsTableProps) {
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
  /**
   * Sends a request to change order. If same field was sent, it means we want
   * to change order. If different field, it means default order for that field.
   */
  onChangeOrder(columnId: ProjectFieldName) {
    if (this.props.orderFieldName === columnId) {
      // clicking already selected column results in switching the order direction
      let newVal: OrderDirection = 'ascending';
      if (this.props.orderDirection === 'ascending') {
        newVal = 'descending';
      }
      this.props.onOrderChangeRequested(this.props.orderFieldName, newVal);
    } else {
      // change column and revert order direction to default
      this.props.onOrderChangeRequested(columnId, PROJECT_FIELDS[columnId].orderDefaultValue || 'ascending');
    }
  }

  onPopoverSetVisible() {
    this.setState({isPopoverVisible: true});
  }

  /**
   * Safe: returns nothing if pagination properties are not set.
   */
  renderPagination() {
    if (
      this.props.currentPage &&
      this.props.totalPages &&
      this.props.onSwitchPage
    ) {
      const naturalCurrentPage = this.props.currentPage + 1;
      return (
        <bem.ProjectsTablePagination>
          <bem.ProjectsTablePagination__button
            disabled={this.props.currentPage === 0}
            onClick={this.switchPage.bind(this, this.props.currentPage - 1)}
          >
            <i className='k-icon k-icon-angle-left'/>
            {t('Previous')}
          </bem.ProjectsTablePagination__button>

          <bem.ProjectsTablePagination__index>
            {/* we avoid displaying 1/0 as it doesn't make sense to humans */}
            {naturalCurrentPage}/{this.props.totalPages || 1}
          </bem.ProjectsTablePagination__index>

          <bem.ProjectsTablePagination__button
            disabled={naturalCurrentPage >= this.props.totalPages}
            onClick={this.switchPage.bind(this, this.props.currentPage + 1)}
          >
            {t('Next')}
            <i className='k-icon k-icon-angle-right'/>
          </bem.ProjectsTablePagination__button>
        </bem.ProjectsTablePagination>
      );
    } else {
      return null;
    }
  }

  renderFooter() {
    return (
      <bem.ProjectsTable__footer>
        {this.props.totalAssets !== null &&
          <span>
            {t('##count## items').replace('##count##', String(this.props.totalAssets))}
          </span>
        }

        {this.renderPagination()}

        {this.props.totalAssets !== null &&
          <button
            className='mdl-button'
            onClick={this.toggleFullscreen.bind(this)}
          >
            {t('Toggle fullscreen')}
            <i className='k-icon k-icon-expand' />
          </button>
        }
      </bem.ProjectsTable__footer>
    );
  }

  render() {
    const modifiers: string[] = [];
    if (this.state.isFullscreen) {
      modifiers.push('fullscreen');
    }

    return (
      <bem.ProjectsTable m={modifiers}>
        <ProjectsTableHeader
          orderFieldName={this.props.orderFieldName}
          orderDirection={this.props.orderDirection}
          onChangeOrderRequested={this.onChangeOrder.bind(this)}
        />

        <bem.ProjectsTable__body ref={this.bodyRef}>
          {this.props.isLoading &&
            <LoadingSpinner/>
          }

          {!this.props.isLoading && this.props.assets.length === 0 &&
            <bem.ProjectsTableRow m='empty-message'>
              {this.props.emptyMessage || t('There are no assets to display.')}
            </bem.ProjectsTableRow>
          }

          {!this.props.isLoading && this.props.assets.map((asset) =>
            <ProjectsTableRow
              asset={asset}
              key={asset.uid}
            />
          )}
        </bem.ProjectsTable__body>

        {this.renderFooter()}
      </bem.ProjectsTable>
    );
  }
}
