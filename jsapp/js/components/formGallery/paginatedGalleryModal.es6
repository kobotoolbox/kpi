import React from 'react';
import autoBind from 'react-autobind';
import bem from '../../bem';
import ui from '../../ui';
import FormGalleryGridItem from './formGalleryGridItem';
import { dataInterface } from '../../dataInterface';
import {
  t,
  formatTimeDate
} from '../../utils';
import ReactPaginate from 'react-paginate';
import Select from 'react-select';

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
      attachments_count: this.props.galleryAttachmentsCount,
      totalPages: 0,
      currentAttachmentsLoaded: 0,
      activeAttachmentsIndex: 0
    };
  }

  componentDidMount() {
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
        <ui.Modal open large onClose={this.props.togglePaginatedGalleryModal}>
          <ui.Modal.Body>
            <bem.PaginatedGalleryModal_heading>
              <h2>{t('All photos of') + ' ' + this.props.galleryTitle}</h2>
              {/* <h4>{t('Showing')} <b>{this.state.currentAttachmentsLoaded}</b> {t('of')} <b>{this.props.galleryAttachmentsCount}</b></h4> */}
              <h4>
                {t('Showing')}
                {' '}
                <b>{this.state.offset}</b>
                {' '}
                {t('of')}
                {' '}
                <b>{this.props.galleryAttachmentsCount}</b>
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
                <bem.AssetGallery__grid>
                  {this.state.paginated_attachments[
                    'page_' + (this.state.activeAttachmentsIndex + 1)
                  ] != undefined
                    ? this.state.paginated_attachments[
                        'page_' + (this.state.activeAttachmentsIndex + 1)
                      ].map(
                        function(item, j) {
                          var timestamp = this.props.currentFilter ===
                            'question'
                            ? item.submission.date_created
                            : this.props.galleryDate;
                          return (
                            <FormGalleryGridItem
                              key={j}
                              itemsPerRow='10'
                              date={formatTimeDate(timestamp)}
                              itemTitle={
                                this.props.currentFilter === 'question'
                                  ? t('Record') + ' ' + item.id
                                  : item.question.label
                              }
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
                </bem.AssetGallery__grid>
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

          </ui.Modal.Body>
        </ui.Modal>
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
