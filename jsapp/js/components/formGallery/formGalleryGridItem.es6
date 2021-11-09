import React from 'react';
import bem from 'js/bem';
import {galleryActions} from './galleryInterface';

export default class FormGalleryGridItem extends React.Component {
  openMediaInModal() {
    galleryActions.openMediaModal({
      galleryIndex: parseInt(this.props.galleryIndex),
      mediaIndex: parseInt(this.props.mediaIndex),
    });
  }

  render() {
    const itemStyle = {
      backgroundImage: `url(${this.props.url})`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center center',
      backgroundSize: 'cover',
    };
    return (
      <bem.AssetGalleryGrid__item
        className='one-one'
        style={itemStyle}
        onClick={this.openMediaInModal.bind(this)}
      >
        <bem.AssetGalleryGrid__itemOverlay>
          <bem.AssetGalleryGrid__itemOverlayText>
            <h5>{this.props.mediaTitle}</h5>
            <p>{this.props.date}</p>
          </bem.AssetGalleryGrid__itemOverlayText>
        </bem.AssetGalleryGrid__itemOverlay>
      </bem.AssetGalleryGrid__item>
    );
  }
}
