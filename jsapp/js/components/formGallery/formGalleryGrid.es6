import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem from '../../bem';
import FormGalleryGridItem from './formGalleryGridItem';
import PaginatedGalleryModal from './paginatedGalleryModal';
import stores from '../../stores';
import {galleryActions, galleryStore} from './galleryInterface';
import {
  t,
  formatTimeDate
} from '../../utils';
import {
  MODAL_TYPES,
  GALLERY_FILTER_OPTIONS
} from '../../constants';

export default class FormGalleryGrid extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      galleryPage: 1,
      hasMoreAttachments: false,
      loadedAttachmentsCount: 0,
      filterGroupBy: galleryStore.getInitialState().filterGroupBy
    };
  }

  componentDidMount() {
    this.refreshHasMoreAttachments();
    this.setState({ galleryPage: this.state.galleryPage + 1 });
    this.listenTo(galleryStore, (storeChanges) => {
      if (storeChanges.filterGroupBy) {
        this.setState({filterGroupBy: storeChanges.filterGroupBy});
      }
    });
  }

  refreshHasMoreAttachments() {
    const loadedAttachmentsCount = this.state.galleryPage * this.props.defaultPageSize;
    this.setState({
      hasMoreAttachments: this.props.totalAttachmentsCount > loadedAttachmentsCount,
      loadedAttachmentsCount: loadedAttachmentsCount
    });
  }

  loadMoreAttachments() {
    this.props.loadMoreAttachments(
      this.props.galleryIndex,
      this.state.galleryPage
    );

    this.refreshHasMoreAttachments();

    let newGalleryPage = this.state.hasMoreAttachments
      ? this.state.galleryPage + 1
      : this.state.galleryPage;

    this.setState({galleryPage: newGalleryPage});
  }

  renderLoadMoreButton() {
    if (
      this.state.hasMoreAttachments &&
      this.state.filterGroupBy.value === GALLERY_FILTER_OPTIONS.question.value
    ) {
      if (this.state.galleryPage <= 2) {
        return (
          <bem.AssetGallery__loadMore>
            <button
              onClick={this.loadMoreAttachments}
              className='mdl-button mdl-button--colored'
            >
              {t('Load More')}
            </button>
          </bem.AssetGallery__loadMore>
        );
      } else {
        return (
          <bem.AssetGallery__loadMore>
            <button
              onClick={this.openPaginatedGalleryModal.bind(this)}
              className='mdl-button mdl-button--colored'
            >
              {t('See all ##count## images').replace('##count##', this.props.totalAttachmentsCount)}
            </button>
          </bem.AssetGallery__loadMore>
        );
      }
    }
    return null;
  }

  openPaginatedGalleryModal() {
    stores.pageState.showModal({
      type: MODAL_TYPES.GALLERY_PAGINATED,
      uid: this.props.uid,
      loadedAttachmentsCount: this.state.loadedAttachmentsCount,
      totalAttachmentsCount: this.props.totalAttachmentsCount,
      galleryItems: this.props.galleryItems,
      galleryTitle: this.props.galleryTitle,
      galleryDate: this.props.galleryDate,
      galleryIndex: this.props.galleryIndex
    });
  }

  render() {
    return (
      <React.Fragment key={this.props.galleryIndex}>
        <h2>{this.props.galleryTitle}</h2>

        <bem.AssetGalleryGrid m={'6-per-row'}>
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
                  date={formatTimeDate(timestamp)}
                  itemTitle={itemTitle}
                  url={item.small_download_url}
                  gallery={this.props.gallery.attachments.results}
                  galleryTitle={this.props.gallery.label}
                  galleryItemIndex={j}
                />
              );
            }.bind(this)
          )}
        </bem.AssetGalleryGrid>

        {this.renderLoadMoreButton()}
      </React.Fragment>
    );
  }
};

reactMixin(FormGalleryGrid.prototype, Reflux.ListenerMixin);
