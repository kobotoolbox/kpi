import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem from '../../bem';
import FormGalleryGridItem from './formGalleryGridItem';
import PaginatedGalleryModal from './paginatedGalleryModal';
import stores from '../../stores';
import {
  t,
  formatTimeDate
} from '../../utils';
import {GALLERY_FILTER_OPTIONS} from '../../constants';

export default class FormGalleryGrid extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      galleryPage: 1,
      hasMoreAttachments: false,
      showPaginatedGalleryModal: false,
      currentlyLoadedGalleryAttachments: 0,
      filterGroupBy: stores.currentGallery.state.filterGroupBy
    };
  }

  componentDidMount() {
    this.updateHasMoreAttachments();
    this.setState({ galleryPage: this.state.galleryPage + 1 });
    this.listenTo(stores.currentGallery, (storeChanges) => {
      if (storeChanges.filterGroupBy) {
        this.setState({filterGroupBy: storeChanges.filterGroupBy});
      }
    });
  }

  updateHasMoreAttachments() {
    let currentlyLoadedGalleryAttachments =
      this.state.galleryPage * this.props.defaultPageSize;
    let galleryHasMore = currentlyLoadedGalleryAttachments <
      this.props.galleryAttachmentsCount
      ? true
      : false;
    this.setState({
      hasMoreAttachments: galleryHasMore,
      currentlyLoadedGalleryAttachments
    });
  }

  loadMoreAttachments() {
    this.props.loadMoreAttachments(
      this.props.galleryIndex,
      this.state.galleryPage
    );
    this.updateHasMoreAttachments();
    let newGalleryPage = this.state.hasMoreAttachments
      ? this.state.galleryPage + 1
      : this.state.galleryPage;
    this.setState({ galleryPage: newGalleryPage });
  }

  toggleLoadMoreBtn() {
    let loadMoreBtnCode = null;
    if (
      this.state.hasMoreAttachments && this.state.filterGroupBy.value === GALLERY_FILTER_OPTIONS.question.value
    ) {
      if (this.state.galleryPage <= 2) {
        loadMoreBtnCode = (
          <button
            onClick={this.loadMoreAttachments}
            className='mdl-button mdl-button--colored loadmore-button'
          >
            {t('Load More')}
          </button>
        );
      } else {
        loadMoreBtnCode = (
          <button
            onClick={this.togglePaginatedGalleryModal}
            className='mdl-button mdl-button--colored loadmore-button'
          >
            {t('See all ##count## images').replace('##count##', this.props.galleryAttachmentsCount)}
          </button>
        );
      }
    }
    return loadMoreBtnCode;
  }

  togglePaginatedGalleryModal() {
    this.setState({ showPaginatedGalleryModal: !this.state.showPaginatedGalleryModal });
    this.props.setActiveGalleryDateAndTitle(
      this.props.galleryTitle,
      this.props.galleryDate
    );
  }

  render() {
    return (
      <div key={this.props.galleryIndex}>
        <h2>{this.props.galleryTitle}</h2>

        <bem.AssetGallery__grid>
          {this.props.galleryItems.map(
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
                  itemsPerRow='6'
                  date={formatTimeDate(timestamp)}
                  itemTitle={itemTitle}
                  url={item.small_download_url}
                  gallery={this.props.gallery}
                  galleryItemIndex={j}
                  openModal={this.props.openModal}
                />
              );
            }.bind(this)
          )}
        </bem.AssetGallery__grid>

        <div className='form-view__cell form-view__cell--centered loadmore-div'>
          {this.toggleLoadMoreBtn()}
        </div>

        {this.state.showPaginatedGalleryModal
          ? <PaginatedGalleryModal
              togglePaginatedGalleryModal={this.togglePaginatedGalleryModal}
              uid={this.props.uid}
              currentlyLoadedGalleryAttachments={
                this.state.currentlyLoadedGalleryAttachments
              }
              galleryAttachmentsCount={this.props.galleryAttachmentsCount}
              galleryItems={this.props.galleryItems}
              galleryTitle={this.props.galleryTitle}
              galleryDate={this.props.galleryDate}
              galleryIndex={this.props.galleryIndex}
              currentFilter={this.state.filterGroupBy}
              openModal={this.props.openModal}
            />
          : null}
      </div>
    );
  }
};

reactMixin(FormGalleryGrid.prototype, Reflux.ListenerMixin);
