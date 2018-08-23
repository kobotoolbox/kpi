import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem from '../../bem';
import FormGalleryGridItem from './formGalleryGridItem';
import PaginatedGalleryModal from './paginatedGalleryModal';
import stores from '../../stores';
import {
  PAGE_SIZE,
  GROUPBY_OPTIONS,
  galleryActions,
  galleryStore
} from './galleryInterface';
import {
  t,
  formatTimeDate
} from '../../utils';
import {MODAL_TYPES} from '../../constants';

const GRID_PAGE_LIMIT = PAGE_SIZE * 2;

export default class FormGalleryGrid extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      gallery: galleryStore.state.galleries[this.props.galleryIndex],
      galleryTitle: galleryActions.getGalleryTitle(this.props.galleryIndex),
      isLoading: galleryStore.state.areLoadingMedias[this.props.galleryIndex] === true,
      filterGroupBy: galleryStore.state.filterGroupBy
    };
  }

  componentDidMount() {
    this.listenTo(galleryStore, (storeChanges) => {
      if (storeChanges.galleries) {
        this.setState({gallery: storeChanges.galleries[this.props.galleryIndex]});
      }
      if (storeChanges.areLoadingMedias) {
        this.setState({isLoading: storeChanges.areLoadingMedias[this.props.galleryIndex] === true});
      }
      if (storeChanges.filterGroupBy) {
        this.setState({filterGroupBy: storeChanges.filterGroupBy});
      }
    });
  }

  getTotalCount() {
    return this.state.gallery.attachments.count;
  }

  getMediaDate(media) {
    const galleryDateCreated = this.state.gallery.date_created;
    if (
      this.state.filterGroupBy.value === GROUPBY_OPTIONS.question.value &&
      galleryDateCreated
    ) {
      return galleryDateCreated;
    } else if (media.submission && media.submission.date_created) {
      return media.submission.date_created;
    }
  }

  getMediaTitle(media, mediaIndex) {
    if (this.state.filterGroupBy.value === GROUPBY_OPTIONS.question.value) {
      return t('Record') + ' ' + parseInt(mediaIndex + 1)
    } else if (media.question && media.question.label) {
      return media.question.label;
    }
  }

  hasMoreAttachments() {
    return this.state.gallery.attachments.next;
  }

  hasReachedGridLimit() {
    return this.state.gallery.attachments.results.length >= GRID_PAGE_LIMIT;
  }

  loadMoreAttachments() {
    galleryActions.loadMoreGalleryMedias(this.props.galleryIndex);
  }

  renderLoadMoreButton() {
    if (this.state.isLoading) {
      return (
        <bem.AssetGallery__loadMore>
          <bem.AssetGallery__loadMoreMessage>
            {t('Loading…')}
          </bem.AssetGallery__loadMoreMessage>
        </bem.AssetGallery__loadMore>
      );
    } else if (this.hasMoreAttachments()) {
      if (this.hasReachedGridLimit()) {
        return (
          <bem.AssetGallery__loadMore>
            <bem.AssetGallery__loadMoreButton onClick={this.openPaginatedGalleryModal.bind(this)}>
              {t('See all ##count## images').replace('##count##', this.getTotalCount())}
            </bem.AssetGallery__loadMoreButton>
          </bem.AssetGallery__loadMore>
        );
      } else {
        return (
          <bem.AssetGallery__loadMore>
            <bem.AssetGallery__loadMoreButton onClick={this.loadMoreAttachments.bind(this)}>
              {t('Load More')}
            </bem.AssetGallery__loadMoreButton>
          </bem.AssetGallery__loadMore>
        );
      }
    }
    return null;
  }

  openPaginatedGalleryModal() {
    stores.pageState.showModal({
      type: MODAL_TYPES.GALLERY_PAGINATED,
      galleryIndex: this.props.galleryIndex
    });
  }

  render() {
    return (
      <React.Fragment key={this.props.galleryIndex}>
        <h2>{this.state.galleryTitle}</h2>

        <bem.AssetGalleryGrid m={'6-per-row'}>
          {this.state.gallery.attachments.results.map(
            (media, index) => {
              return (
                <FormGalleryGridItem
                  key={index}
                  url={media.small_download_url}
                  galleryIndex={this.props.galleryIndex}
                  mediaIndex={index}
                  mediaTitle={this.getMediaTitle(media, index)}
                  date={formatTimeDate(this.getMediaDate(media))}
                />
              );
            }
          )}
        </bem.AssetGalleryGrid>

        {this.renderLoadMoreButton()}
      </React.Fragment>
    );
  }
};

reactMixin(FormGalleryGrid.prototype, Reflux.ListenerMixin);
