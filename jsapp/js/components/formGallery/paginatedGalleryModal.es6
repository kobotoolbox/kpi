import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem from '../../bem';
import stores from '../../stores';
import {galleryActions, galleryStore} from './galleryInterface';
import { dataInterface } from '../../dataInterface';
import FormGalleryGridItem from './formGalleryGridItem';
import {
  t,
  formatTimeDate
} from '../../utils';
import ReactPaginate from 'react-paginate';
import Select from 'react-select';
import {
  GALLERY_FILTER_OPTIONS
} from '../../constants';

export default class PaginatedGalleryModal extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      offset: 10,
      offsetOptions: [
        {
          value: 10,
          label: 10
        },
        {
          value: 25,
          label: 25
        },
        {
          value: 50,
          label: 50
        },
        {
          value: 100,
          label: 100
        }
      ],
      sortOptions: [
        {
          label: t('Show latest first'),
          value: 'desc'
        },
        {
          label: t('Show oldest first'),
          value: 'asc'
        }
      ],
      sortValue: 'asc',
      paginated_attachments: [],
      flat_attachments: [],
      attachments_count: this.props.totalAttachmentsCount,
      totalPages: 0,
      currentAttachmentsLoaded: 0,
      activeAttachmentsIndex: 0,
      filterGroupBy: galleryStore.getInitialState().filterGroupBy
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
      this.state.attachments_count / this.state.offset
    );
    this.setState({ totalPages: totalPages });
  }
  setActiveAttachmentsIndex(index) {
    this.setState({ activeAttachmentsIndex: index });
  }
  changeOffset(offset) {
    this.setState({ offset: offset }, function() {
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
        this.state.offset,
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
            <b>{this.state.offset}</b>
            {' '}
            {t('of')}
            {' '}
            <b>{this.props.totalAttachmentsCount}</b>
          </h4>
        </bem.PaginatedGalleryModal_heading>

        <bem.PaginatedGalleryModal_body>
          <GalleryControls
            offsetOptions={this.state.offsetOptions}
            offsetValue={this.state.offset}
            changeOffset={this.changeOffset}
            pageCount={this.state.totalPages}
            goToPage={this.goToPage}
            activeAttachmentsIndex={this.state.activeAttachmentsIndex}
            sortOptions={this.state.sortOptions}
            sortValue={this.state.sortValue}
            changeSort={this.changeSort}
          />

          <div className='paginated-modal__body__gallery-wrapper'>
            <bem.AssetGalleryGrid m='10-per-row'>
              {this.state.paginated_attachments[
                'page_' + (this.state.activeAttachmentsIndex + 1)
              ] != undefined
                ? this.state.paginated_attachments[
                    'page_' + (this.state.activeAttachmentsIndex + 1)
                  ].map(
                    function(item, j) {
                      let timestamp;
                      if (
                        this.state.filterGroupBy.value === GALLERY_FILTER_OPTIONS.question.value &&
                        this.props.gallery &&
                        this.props.gallery.date_created
                      ) {
                        timestamp = this.props.gallery.date_created;
                      } else if (item.submission && item.submission.date_created) {
                        timestamp = item.submission.date_created;
                      }

                      let itemTitle;
                      if (
                        this.state.filterGroupBy.value === GALLERY_FILTER_OPTIONS.question.value
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
                          galleryItemIndex={this.findItemIndex(item.id)}
                          openModal={this.props.openModal}
                          setGalleryDateAndTitleonModalOpen={false}
                        />
                      );
                    }.bind(this)
                  )
                : null}
            </bem.AssetGalleryGrid>
          </div>

          <GalleryControls
            offsetOptions={this.state.offsetOptions}
            offsetValue={this.state.offset}
            changeOffset={this.changeOffset}
            pageCount={this.state.totalPages}
            goToPage={this.goToPage}
            activeAttachmentsIndex={this.state.activeAttachmentsIndex}
            sortOptions={this.state.sortOptions}
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
    let selectDirectionClassName = this.props.selectDirectionUp
      ? 'select-direction-up'
      : '';
    return (
      <div
        className={
          'paginated-modal__body__gallery-controls ' + selectDirectionClassName
        }
      >
        <div className='change-offset'>
          <label>{t('Per page:')}</label>
          <div className='form-modal__item'>
            <Select
              className='icon-button-select'
              options={this.props.offsetOptions}
              simpleValue
              name='selected-filter'
              value={this.props.offsetValue}
              onChange={this.props.changeOffset}
              autoBlur
              searchable={false}
              clearable={false}
            />
          </div>
        </div>
        <div className='form-modal__item'>
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
        </div>

        <div className='form-modal__item change-sort'>
          <Select
            className='icon-button-select'
            options={this.props.sortOptions}
            simpleValue
            name='selected-filter'
            value={this.props.sortValue}
            onChange={this.props.changeSort}
            autoBlur
            searchable={false}
            clearable={false}
          />
        </div>
      </div>
    );
  }
};

reactMixin(PaginatedGalleryModal.prototype, Reflux.ListenerMixin);
