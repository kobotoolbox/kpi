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
  GRID_PAGE_LIMIT,
  GROUPBY_OPTIONS,
  galleryActions,
  galleryStore
} from './galleryInterface';
import {
  t,
  formatTimeDate
} from '../../utils';
import {MODAL_TYPES} from '../../constants';

export default class FormGalleryGrid extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      gallery: galleryStore.state.galleries[this.props.galleryIndex],
      filterGroupBy: galleryStore.state.filterGroupBy
    };
  }

  componentDidMount() {
    this.listenTo(galleryStore, (storeChanges) => {
      if (typeof storeChanges.galleries !== 'undefined') {
        this.setState({gallery: storeChanges.galleries[this.props.galleryIndex]});
      }
      if (typeof storeChanges.filterGroupBy !== 'undefined') {
        this.setState({filterGroupBy: storeChanges.filterGroupBy});
      }
    });
  }

  hasMoreAttachments() {
    return this.state.gallery.loadedMediaCount < this.state.gallery.totalMediaCount;
  }

  hasReachedGridLimit() {
    return this.state.gallery.loadedMediaCount >= GRID_PAGE_LIMIT;
  }

  loadMoreMedia() {
    galleryActions.loadMoreGalleryMedias(this.state.gallery.galleryIndex);
  }

  renderLoadMoreButton() {
    if (this.state.gallery.isLoadingMedias) {
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
              {t('See all ##count## images').replace('##count##', this.state.gallery.totalMediaCount)}
            </bem.AssetGallery__loadMoreButton>
          </bem.AssetGallery__loadMore>
        );
      } else {
        return (
          <bem.AssetGallery__loadMore>
            <bem.AssetGallery__loadMoreButton onClick={this.loadMoreMedia.bind(this)}>
              {t('Load More')}
            </bem.AssetGallery__loadMoreButton>
          </bem.AssetGallery__loadMore>
        );
      }
    }
    return null;
  }

  openPaginatedGalleryModal() {
    galleryActions.openPaginatedModal({galleryIndex: this.state.gallery.galleryIndex});
  }

  render() {
    return (
      <React.Fragment key={this.state.gallery.galleryIndex}>
        <h2>{this.state.gallery.title}</h2>

        <bem.AssetGalleryGrid m={'6-per-row'}>
          {this.state.gallery.medias.map(
            (media, index) => {
              return (
                <FormGalleryGridItem
                  key={index}
                  url={media.smallImage}
                  galleryIndex={this.state.gallery.galleryIndex}
                  mediaIndex={media.mediaIndex}
                  mediaTitle={media.title}
                  date={media.date}
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
