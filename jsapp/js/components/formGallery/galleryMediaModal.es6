import _ from 'underscore';
import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem from '../../bem';
import ui from '../../ui';
import stores from '../../stores';
import {
  galleryActions,
  galleryStore
} from './galleryInterface';
import {
  assign,
  t
} from '../../utils';

export default class GalleryMediaModal extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      gallery: galleryStore.state.galleries[galleryStore.state.selectedGalleryIndex],
      selectedMedia: galleryStore.state.selectedMedia,
      filterGroupBy: galleryStore.state.filterGroupBy
    };
  }

  componentDidMount() {
    this.listenTo(galleryStore, (storeChanges) => {
      if (storeChanges.galleries) {
        this.setState({gallery: storeChanges.galleries[galleryStore.state.selectedGalleryIndex]});
      }
      if (storeChanges.selectedMedia) {
        this.setState({selectedMedia: storeChanges.selectedMedia});
      }
      if (storeChanges.filterGroupBy) {
        this.setState({filterGroupBy: storeChanges.filterGroupBy});
      }
    });
  }

  onBeforeSliderChange(prevIndex, newIndex) {
    this.setState({currentSliderIndex: newIndex});
  }

  showMoreFrom(questionName) {
    galleryActions.setFilters({filterQuery: questionName});
    stores.pageState.hideModal();
  }

  selectMedia(evt) {
    galleryActions.selectGalleryMedia({mediaIndex: evt.currentTarget.dataset.index});
  }

  goBy(indexChange) {
    let newIndex = this.state.selectedMedia.mediaIndex + 1;
    // safe check
    if (newIndex >= this.state.gallery.totalMediaCount - 1) {
      newIndex = this.state.gallery.totalMediaCount - 1;
    }
    if (newIndex < 0) {
      newIndex = 0;
    }
    galleryActions.selectGalleryMedia({mediaIndex: newIndex});
  }

  isAbleToGoLeft() {
    return true;
  }

  goLeft() {
    this.goBy(-1);
  }

  isAbleToGoRight() {
    return true;
  }

  goRight() {
    this.goBy(1);
  }

  renderImage() {
    const inlineStyle = {'backgroundImage': `url(${this.state.selectedMedia.largeImage})`};

    return (
      <bem.GalleryMediaModal__content>
        <bem.GalleryMediaModal__contentArrow
          onClick={this.goLeft.bind(this)}
          disabled={false}
          m='left'
        >
          <i className='k-icon-prev'/>
        </bem.GalleryMediaModal__contentArrow>

        <bem.GalleryMediaModal__contentImage
          style={inlineStyle}
          title={this.state.selectedMedia.filename}
         />

        <bem.GalleryMediaModal__contentArrow
          onClick={this.goRight.bind(this)}
          disabled={false}
          m='right'
        >
          <i className='k-icon-next'/>
        </bem.GalleryMediaModal__contentArrow>
      </bem.GalleryMediaModal__content>
    );
  }

  renderSidebar() {
    return (
      <bem.GalleryMediaModal__sidebar>
        <bem.GalleryMediaModal__sidebarInfo>
          <p>{t('Record')} #{galleryStore.state.selectedMedia.mediaIndex + 1}</p>
          <h3>{this.state.gallery.title}</h3>
          <p>{this.state.gallery.dateCreated}</p>
        </bem.GalleryMediaModal__sidebarInfo>

        {this.state.gallery.medias &&
          <bem.GalleryMediaModal__sidebarGridWrap>
            <h5 onClick={() => this.showMoreFrom(this.state.gallery.title)}>
              {t('More from ##question##').replace('##question##', this.state.gallery.title)}
            </h5>

            <bem.GalleryMediaModal__sidebarGrid>
              {this.state.gallery.medias.map(
                (media) => {
                  const divStyle = {
                    backgroundImage: `url(${media.mediumImage})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center center',
                    backgroundSize: 'cover'
                  };
                  return (
                    <bem.GalleryMediaModal__sidebarGridItem
                      m={galleryStore.state.selectedMedia.mediaIndex === media.mediaIndex ? 'selected' : null}
                      data-index={media.mediaIndex}
                      onClick={this.selectMedia.bind(this)}
                      key={media.mediaIndex}
                    >
                      <div className='one-one' style={divStyle} />
                    </bem.GalleryMediaModal__sidebarGridItem>
                  );
                }
              )}
            </bem.GalleryMediaModal__sidebarGrid>
          </bem.GalleryMediaModal__sidebarGridWrap>
        }
      </bem.GalleryMediaModal__sidebar>
    );
  }

  render() {
    return (
      <bem.GalleryMediaModal>
        {this.state.isLoading &&
          <bem.Loading>
            <bem.Loading__inner>
              <i />
              {t('Loading…')}
            </bem.Loading__inner>
          </bem.Loading>
        }
        {!this.state.isLoading &&
          <React.Fragment>
            {this.renderImage()}
            {this.renderSidebar()}
          </React.Fragment>
        }
      </bem.GalleryMediaModal>
    );
  }
};

reactMixin(GalleryMediaModal.prototype, Reflux.ListenerMixin);
