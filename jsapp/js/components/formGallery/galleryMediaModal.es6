import _ from 'underscore';
import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import mixins from '../../mixins';
import bem from '../../bem';
import stores from '../../stores';
import {
  galleryActions,
  galleryStore
} from './galleryInterface';
import {t} from '../../utils';
import {MODAL_TYPES} from '../../constants';

export default class GalleryMediaModal extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      selectedMedia: galleryStore.state.selectedMedia,
      displayImageUrl: null
    };
    this.preloadMediaImage(galleryStore.state.selectedMedia.data);
  }

  componentDidMount() {
    this.listenTo(galleryStore, (storeChanges) => {
      if (storeChanges.selectedMedia) {
        this.setState({
          selectedMedia: storeChanges.selectedMedia,
          displayImageUrl: null
        });
        this.preloadMediaImage(storeChanges.selectedMedia.data);
      }
    });
  }

  preloadMediaImage(mediaData) {
    if (mediaData === null) {
      return;
    }
    const imageUrl = mediaData.largeImage;
    const img = new window.Image();
    img.onload = () => {
      if (
        this.state.selectedMedia.data !== null &&
        img.src === this.state.selectedMedia.data.largeImage
      ) {
        this.setState({displayImageUrl: imageUrl});
      }
    };
    img.src = imageUrl;
  }

  showMoreFrom(questionName) {
    galleryActions.setFilters({filterQuery: questionName});
    stores.pageState.hideModal();
  }

  openSubmissionModal() {
    const currentAsset = this.currentAsset();
    stores.pageState.switchModal({
      type: MODAL_TYPES.SUBMISSION,
      sid: this.state.selectedMedia.data.sid,
      asset: currentAsset,
      ids: [this.state.selectedMedia.data.sid]
    });
  }

  goLeft() {
    galleryActions.selectPreviousGalleryMedia();
  }

  goRight() {
    galleryActions.selectNextGalleryMedia();
  }

  renderMedia() {
    const inlineStyle = {};
    if (this.state.displayImageUrl !== null) {
      inlineStyle.backgroundImage = `url(${this.state.displayImageUrl})`;
    }

    return (
      <React.Fragment>
        <bem.GalleryMediaModal__contentArrow
          onClick={this.goLeft}
          disabled={this.state.selectedMedia.isFirst}
          m='left'
        >
          {this.state.selectedMedia.isFirstInGallery &&
            <i className='k-icon k-icon-arrow-first'/>
          }
          {!this.state.selectedMedia.isFirstInGallery &&
            <i className='k-icon k-icon-prev'/>
          }
        </bem.GalleryMediaModal__contentArrow>

        <bem.GalleryMediaModal__contentImage
          m={this.state.displayImageUrl === null ? 'hidden' : 'visible'}
          key={this.state.selectedMedia.data.mediaId}
          style={inlineStyle}
          title={this.state.selectedMedia.data.filename}
         />

         {this.state.displayImageUrl === null &&
           <bem.Loading>
             <bem.Loading__inner>
               <i />
             </bem.Loading__inner>
           </bem.Loading>
         }

        <bem.GalleryMediaModal__contentArrow
          onClick={this.goRight}
          disabled={this.state.selectedMedia.isLast}
          m='right'
        >
          {this.state.selectedMedia.isLastInGallery &&
            <i className='k-icon k-icon-arrow-last'/>
          }
          {!this.state.selectedMedia.isLastInGallery &&
            <i className='k-icon k-icon-next'/>
          }
        </bem.GalleryMediaModal__contentArrow>
      </React.Fragment>
    );
  }

  renderSidebar() {
    return (
      <React.Fragment>
        <bem.GalleryMediaModal__sidebarInfo>
          <bem.GalleryMediaModal__sidebarTitle>
            {this.state.selectedMedia.data.questionLabel}
          </bem.GalleryMediaModal__sidebarTitle>

          <bem.GalleryMediaModal__sidebarSubtitle>
            {this.state.selectedMedia.data.submissionLabel}
          </bem.GalleryMediaModal__sidebarSubtitle>

          <p>{this.state.selectedMedia.data.date}</p>
        </bem.GalleryMediaModal__sidebarInfo>

        <bem.GalleryMediaModal__sidebarInfo>
          <button onClick={this.openSubmissionModal}>
            {t('Submission details')}
          </button>
        </bem.GalleryMediaModal__sidebarInfo>
      </React.Fragment>
    );
  }

  render() {
    return (
      <bem.GalleryMediaModal>
        <bem.GalleryMediaModal__content>
          {this.state.selectedMedia.isLoading &&
            <bem.Loading>
              <bem.Loading__inner>
                <i />
              </bem.Loading__inner>
            </bem.Loading>
          }
          {!this.state.selectedMedia.isLoading &&
            this.renderMedia()
          }
        </bem.GalleryMediaModal__content>

        <bem.GalleryMediaModal__sidebar>
          {!this.state.selectedMedia.isLoading &&
            this.renderSidebar()
          }
        </bem.GalleryMediaModal__sidebar>
      </bem.GalleryMediaModal>
    );
  }
};

reactMixin(GalleryMediaModal.prototype, Reflux.ListenerMixin);
reactMixin(GalleryMediaModal.prototype, mixins.contextRouter);

GalleryMediaModal.contextTypes = {
  router: PropTypes.object
};
