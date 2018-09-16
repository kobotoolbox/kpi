import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem from '../../bem';
import { dataInterface } from '../../dataInterface';
import stores from '../../stores';
import {
  galleryActions,
  galleryStore
} from './galleryInterface';
import FormGalleryFilter from './formGalleryFilter';
import FormGalleryGrid from './formGalleryGrid';
import {
  t,
  assign,
  formatTimeDate
} from '../../utils';
import {MODAL_TYPES} from '../../constants';

export default class FormGallery extends React.Component {
  constructor(props) {
    super(props);
    this.state = this.getInitialState();
    autoBind(this);
  }

  componentDidMount() {
    if (this.hasAnyMediaQuestions()) {
      galleryActions.setFormUid(this.props.uid);
      this.listenTo(galleryStore, (storeChanges) => {
        this.setState(storeChanges);
      });
    }
  }

  componentWillUnmount() {
    galleryActions.setFormUid(null);
  }

  getInitialState() {
    const stateObj = {}
    assign(stateObj, galleryStore.state);
    return stateObj;
  }

  hasAnyMediaQuestions() {
    return this.props.mediaQuestions.length !== 0;
  }

  loadMoreGalleries() {
    galleryActions.loadMoreGalleries();
  }

  isGalleryMatchingSearchQuery(gallery) {
    if (this.state.filterQuery === '') {
      return true;
    } else {
      const searchRegEx = new RegExp(this.state.filterQuery, 'i');
      return (
        searchRegEx.test(gallery.title) ||
        searchRegEx.test(gallery.dateCreated)
      );
    }
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
            <bem.Loading>
              <bem.Loading__inner>
                {t('This form does not have any media questions.')}
              </bem.Loading__inner>
            </bem.Loading>
          </bem.AssetGallery>
        </bem.FormView>
      )
    }

    // CASE: loading data from the start
    else if (
      this.state.isLoadingGalleries ||
      this.state.galleries.length === 0
    ) {
      return (
        <bem.FormView m={formViewModifiers}>
          <bem.AssetGallery>
            <bem.Loading>
              <bem.Loading__inner>
                <i />
                {t('Loading…')}
              </bem.Loading__inner>
            </bem.Loading>
          </bem.AssetGallery>
        </bem.FormView>
        )
    }

    // CASE: some data already loaded and possibly loading more
    else {
      return (
        <bem.FormView m={formViewModifiers}>
          <bem.AssetGallery>
            <FormGalleryFilter/>

            {this.state.galleries.map(
              (gallery, i) => {
                if (this.isGalleryMatchingSearchQuery(gallery)) {
                  return (
                    <FormGalleryGrid key={i} galleryIndex={gallery.galleryIndex}/>
                  );
                } else {
                  return null;
                }
              }
            )}

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
};

reactMixin(FormGallery.prototype, Reflux.ListenerMixin);
