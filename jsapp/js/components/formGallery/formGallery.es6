import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem, {makeBem} from 'js/bem';
import {
  galleryActions,
  galleryStore,
} from './galleryInterface';
import FormGalleryFilter from './formGalleryFilter';
import FormGalleryGrid from './formGalleryGrid';
import {assign} from 'js/utils';
import LoadingSpinner from 'js/components/common/loadingSpinner';

bem.AssetGallery = makeBem(null, 'asset-gallery');
bem.AssetGallery__emptyMessage = makeBem(bem.AssetGallery, 'empty-message');
bem.AssetGallery__loadMore = makeBem(bem.AssetGallery, 'load-more');
bem.AssetGallery__loadMoreMessage = makeBem(bem.AssetGallery, 'load-more-message');
bem.AssetGallery__loadMoreButton = makeBem(bem.AssetGallery, 'load-more-button');

bem.AssetGallery__heading = makeBem(bem.AssetGallery, 'heading');
bem.AssetGallery__headingCount = makeBem(bem.AssetGallery, 'heading-count');
bem.AssetGallery__headingIconButton = makeBem(bem.AssetGallery, 'heading-icon-button');

bem.AssetGallery__loadMore = makeBem(bem.AssetGallery, 'load-more');
bem.AssetGallery__loadMoreMessage = makeBem(bem.AssetGallery, 'load-more-message');
bem.AssetGallery__loadMoreButton = makeBem(bem.AssetGallery, 'load-more-button');

export default class FormGallery extends React.Component {
  constructor(props) {
    super(props);
    this.state = assign({}, galleryStore.state);
    autoBind(this);
  }

  componentDidMount() {
    if (this.hasAnyMediaQuestions()) {
      this.listenTo(galleryStore, (storeChanges) => {
        this.setState(storeChanges);
      });
      galleryActions.setFormUid(this.props.uid);
    }
  }

  componentWillUnmount() {
    galleryActions.setFormUid(null);
  }

  hasAnyMediaQuestions() {
    return this.props.mediaQuestions.length !== 0;
  }

  loadMoreGalleries() {
    galleryActions.loadMoreGalleries();
  }

  render() {
    const formViewModifiers = [];
    if (this.state.isFullscreen) {
      formViewModifiers.push('fullscreen');
    }

    // CASE: form with no media questions
    if (!this.hasAnyMediaQuestions()) {
      return (
        <bem.FormView m={formViewModifiers}>
          <bem.AssetGallery>
            <LoadingSpinner message={t('This form does not have any media questions.')}/>
          </bem.AssetGallery>
        </bem.FormView>
      );
    }

    // CASE: loading data from the start
    else if (
      this.state.formUid === null ||
      (
        this.state.isLoadingGalleries &&
        this.state.galleries.length === 0
      )
    ) {
      return (
        <bem.FormView m={formViewModifiers}>
          <bem.AssetGallery>
            <LoadingSpinner/>
          </bem.AssetGallery>
        </bem.FormView>
      );
    }

    // CASE: some data already loaded and possibly loading more
    else {
      return (
        <bem.FormView m={formViewModifiers}>
          <bem.AssetGallery>
            <FormGalleryFilter/>

            {this.state.filteredGalleries.map(
              (gallery) => (
                <FormGalleryGrid
                  key={gallery.galleryIndex}
                  galleryIndex={gallery.galleryIndex}
                />
              )
            )}

            {this.state.filteredGalleries.length === 0 &&
              <bem.AssetGallery__emptyMessage>
                {t('Your filter matches no galleries')}
              </bem.AssetGallery__emptyMessage>
            }

            { this.state.nextGalleriesPageUrl &&
              this.state.filterQuery === '' &&
              <bem.AssetGallery__loadMore>
                {this.state.isLoadingGalleries &&
                  <bem.AssetGallery__loadMoreMessage>
                    {t('Loading…')}
                  </bem.AssetGallery__loadMoreMessage>
                }
                {!this.state.isLoadingGalleries &&
                  <bem.AssetGallery__loadMoreButton onClick={this.loadMoreGalleries}>
                    {t('Load more records')}
                  </bem.AssetGallery__loadMoreButton>
                }
              </bem.AssetGallery__loadMore>
            }
          </bem.AssetGallery>
        </bem.FormView>
      );
    }
  }
}

reactMixin(FormGallery.prototype, Reflux.ListenerMixin);
