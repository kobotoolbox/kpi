import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem from '../../bem';
import stores from '../../stores';
import {
  GROUPBY_OPTIONS,
  galleryActions,
  galleryStore
} from './galleryInterface';
import { dataInterface } from '../../dataInterface';
import FormGalleryGridItem from './formGalleryGridItem';
import {
  t,
  formatTimeDate
} from '../../utils';
import ReactPaginate from 'react-paginate';
import Select from 'react-select';

const OFFSET_OPTIONS = [
  {value: 12, label: '12'},
  {value: 24, label: '24'},
  {value: 48, label: '48'},
  {value: 96, label: '96'}
];
const SORT_OPTIONS = [
  {label: t('Show oldest first'), value: 'asc'},
  {label: t('Show latest first'), value: 'desc'}
];

export default class PaginatedGalleryModal extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      offsetVal: OFFSET_OPTIONS[0].value,
      sortValue: SORT_OPTIONS[0].value,
      paginated_attachments: [],
      flat_attachments: [],
      attachments_count: this.props.totalAttachmentsCount,
      totalPages: 0,
      currentAttachmentsLoaded: 0,
      activeAttachmentsIndex: 0,
      filterGroupBy: galleryStore.state.filterGroupBy
    };
  }

  componentDidMount() {
    this.listenTo(galleryStore, (storeChanges) => {
      if (storeChanges.filterGroupBy) {
        this.setState({filterGroupBy: storeChanges.filterGroupBy});
      }
    });
    this.resetGallery();
  }

  resetGallery() {
    this.setState({
      paginated_attachments: [],
      flat_attachments: [],
      currentAttachmentsLoaded: 0
    });
    this.loadPaginatedAttachments(1);
    this.setTotalPages();
    this.setActiveAttachmentsIndex(0);
  }
  setTotalPages() {
    let totalPages = Math.ceil(
      this.state.attachments_count / this.state.offsetVal
    );
    this.setState({ totalPages: totalPages });
  }
  setActiveAttachmentsIndex(index) {
    this.setState({ activeAttachmentsIndex: index });
  }
  changeOffset(offsetVal) {
    this.setState({ offsetVal: offsetVal }, function() {
      this.resetGallery();
    });
  }
  changeSort(sort) {
    this.setState({ sortValue: sort }, function() {
      this.resetGallery();
    });
  }
  goToPage(page) {
    let attachmentNextPage = page.selected + 1;
    let newActiveIndex = page.selected;
    if (
      this.state.paginated_attachments['page_' + attachmentNextPage] ==
      undefined
    ) {
      this.loadPaginatedAttachments(attachmentNextPage, () => {
        this.setActiveAttachmentsIndex(newActiveIndex);
      });
    } else {
      this.setActiveAttachmentsIndex(newActiveIndex);
    }
  }
  loadPaginatedAttachments(page, callback) {
    dataInterface
      .loadQuestionAttachment(
        this.props.uid,
        'question',
        this.props.galleryIndex,
        page,
        this.state.offsetVal,
        this.state.sortValue
      )
      .done(response => {
        let newPaginatedAttachments = this.state.paginated_attachments;
        let newFlatAttachments = [];
        let currentAttachementsLoaded =
          this.state.currentAttachmentsLoaded +
          response.attachments.results.length;

        newPaginatedAttachments['page_' + page] = response.attachments.results;
        let newAttachmentsKeys = Object.keys(
          this.state.paginated_attachments
        ).sort();
        for (var i = 0; i < newAttachmentsKeys.length; i++) {
          var pageIndex = newAttachmentsKeys[i];
          newFlatAttachments.push(
            ...this.state.paginated_attachments[pageIndex]
          );
        }

        this.setState({
          paginated_attachments: newPaginatedAttachments,
          flat_attachments: newFlatAttachments,
          currentAttachmentsLoaded: currentAttachementsLoaded
        });
      });
    if (callback) {
      callback();
    }
  }
  findItemIndex(id) {
    var newIndex = null;
    this.state.flat_attachments.filter((filteredItem, index) => {
      if (filteredItem.id == id) {
        newIndex = index;
      }
    });
    return newIndex;
  }
  render() {
    return (
      <bem.PaginatedGalleryModal>
        <bem.PaginatedGalleryModal_heading>
          <h2>{t('All photos of') + ' ' + this.props.galleryTitle}</h2>
          <h4>
            {t('Showing')}
            {' '}
            <b>{this.state.offsetVal}</b>
            {' '}
            {t('of')}
            {' '}
            <b>{this.props.totalAttachmentsCount}</b>
          </h4>
        </bem.PaginatedGalleryModal_heading>

        <bem.PaginatedGalleryModal_body>
          <GalleryControls
            offsetValue={this.state.offsetVal}
            changeOffset={this.changeOffset}
            pageCount={this.state.totalPages}
            goToPage={this.goToPage}
            activeAttachmentsIndex={this.state.activeAttachmentsIndex}
            sortValue={this.state.sortValue}
            changeSort={this.changeSort}
          />

          <bem.PaginatedGalleryModal_galleryWrapper>
            <bem.AssetGalleryGrid m='6-per-row'>
              {this.state.paginated_attachments[
                'page_' + (this.state.activeAttachmentsIndex + 1)
              ] != undefined
                ? this.state.paginated_attachments[
                    'page_' + (this.state.activeAttachmentsIndex + 1)
                  ].map(
                    function(item, j) {
                      let timestamp;
                      if (
                        this.state.filterGroupBy.value === GROUPBY_OPTIONS.question.value &&
                        this.props.gallery &&
                        this.props.gallery.date_created
                      ) {
                        timestamp = this.props.gallery.date_created;
                      } else if (item.submission && item.submission.date_created) {
                        timestamp = item.submission.date_created;
                      }

                      let itemTitle;
                      if (
                        this.state.filterGroupBy.value === GROUPBY_OPTIONS.question.value
                      ) {
                        itemTitle = t('Record') + ' ' + parseInt(j + 1)
                      } else if (item.question && item.question.label) {
                        itemTitle = item.question.label;
                      }

                      return (
                        <FormGalleryGridItem
                          key={j}
                          date={formatTimeDate(timestamp)}
                          itemTitle={itemTitle}
                          url={item.small_download_url}
                          gallery={this.state.flat_attachments}
                          galleryTitle={this.props.galleryTitle}
                          galleryItemIndex={this.findItemIndex(item.id)}
                        />
                      );
                    }.bind(this)
                  )
                : null}
            </bem.AssetGalleryGrid>
          </bem.PaginatedGalleryModal_galleryWrapper>

          <GalleryControls
            offsetValue={this.state.offsetVal}
            changeOffset={this.changeOffset}
            pageCount={this.state.totalPages}
            goToPage={this.goToPage}
            activeAttachmentsIndex={this.state.activeAttachmentsIndex}
            sortValue={this.state.sortValue}
            changeSort={this.changeSort}
            selectDirectionUp
          />

        </bem.PaginatedGalleryModal_body>
      </bem.PaginatedGalleryModal>
    );
  }
};

class GalleryControls extends React.Component {
  render() {
    const controlsMod = this.props.selectDirectionUp ? 'select-direction-up' : '';
    return (
      <bem.PaginatedGalleryModal_controls m={controlsMod}>
        <div className='change-offset'>
          <label>{t('Per page:')}</label>

          <Select
            className='Select--underlined'
            options={OFFSET_OPTIONS}
            simpleValue
            name='selected-filter'
            value={this.props.offsetValue}
            onChange={this.props.changeOffset}
            autoBlur
            searchable={false}
            clearable={false}
          />
        </div>

        <ReactPaginate
          previousLabel={'Prev'}
          nextLabel={'Next'}
          breakLabel={'...'}
          breakClassName={'break-me'}
          pageCount={this.props.pageCount}
          marginPagesDisplayed={1}
          pageRangeDisplayed={3}
          onPageChange={this.props.goToPage}
          containerClassName={'pagination'}
          activeClassName={'active'}
          forcePage={this.props.activeAttachmentsIndex}
        />

        <Select
          className='Select--underlined change-sort'
          options={SORT_OPTIONS}
          simpleValue
          name='selected-filter'
          value={this.props.sortValue}
          onChange={this.props.changeSort}
          autoBlur
          searchable={false}
          clearable={false}
        />
      </bem.PaginatedGalleryModal_controls>
    );
  }
};

reactMixin(PaginatedGalleryModal.prototype, Reflux.ListenerMixin);
