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
      selectedMedia: galleryStore.state.selectedMedia
    };
  }

  componentDidMount() {
    this.listenTo(galleryStore, (storeChanges) => {
      if (storeChanges.selectedMedia) {
        this.setState({selectedMedia: storeChanges.selectedMedia});
      }
    });
  }

  showMoreFrom(questionName) {
    galleryActions.setFilters({filterQuery: questionName});
    stores.pageState.hideModal();
  }

  goLeft() {
    galleryActions.selectPreviousGalleryMedia();
  }

  goRight() {
    galleryActions.selectNextGalleryMedia();
  }

  renderMedia() {
    const inlineStyle = {'backgroundImage': `url(${this.state.selectedMedia.data.largeImage})`};
    return (
      <React.Fragment>
        <bem.GalleryMediaModal__contentArrow
          onClick={this.goLeft}
          disabled={this.state.selectedMedia.isFirst}
          m='left'
        >
          <i className='k-icon-prev'/>
        </bem.GalleryMediaModal__contentArrow>

        <bem.GalleryMediaModal__contentImage
          style={inlineStyle}
          title={this.state.selectedMedia.data.filename}
         />

        <bem.GalleryMediaModal__contentArrow
          onClick={this.goRight}
          disabled={this.state.selectedMedia.isLast}
          m='right'
        >
          <i className='k-icon-next'/>
        </bem.GalleryMediaModal__contentArrow>
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
            <bem.GalleryMediaModal__sidebarInfo>
              <h3>{this.state.selectedMedia.data.title}</h3>
              <p>{this.state.selectedMedia.data.dateCreated}</p>
            </bem.GalleryMediaModal__sidebarInfo>
          }
        </bem.GalleryMediaModal__sidebar>
      </bem.GalleryMediaModal>
    );
  }
};

reactMixin(GalleryMediaModal.prototype, Reflux.ListenerMixin);
